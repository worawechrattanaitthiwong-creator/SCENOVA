import { prisma } from "@/lib/db";
import { activateEmergencyLockdown, getEmergencySecurityState, restoreEmergencyState, revokeAllSessions } from "@/lib/emergency-security";

function arg(name: string) {
  const prefix = `--${name}=`;
  const item = process.argv.find((value) => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : "";
}

async function main() {
  const command = process.argv[2] || "status";
  const reason = arg("reason") || `CLI emergency command: ${command}`;

  if (command === "status") {
    const state = await getEmergencySecurityState();
    console.log(JSON.stringify({
      lockdownEnabled: state.lockdownEnabled,
      maintenanceMode: state.maintenanceMode,
      generationDisabled: state.generationDisabled,
      agentDisabled: state.agentDisabled,
      llmDisabled: state.llmDisabled,
      paymentDisabled: state.paymentDisabled,
      newLoginRestricted: state.newLoginRestricted,
      queuePaused: state.queuePaused,
      disabledProviderIds: state.disabledProviderIds,
      sessionInvalidBefore: state.sessionInvalidBefore?.toISOString() || null,
      reason: state.reason,
      environmentHardLock: state.environmentHardLock,
      updatedAt: state.updatedAt.toISOString(),
    }, null, 2));
    return;
  }

  if (command === "lockdown") {
    const state = await activateEmergencyLockdown(null, reason);
    console.log(`[SCENOVA] EMERGENCY LOCKDOWN ACTIVE: ${state.reason}`);
    console.log("All previous sessions are invalid. Generation, Agent, LLM, Wallet/Payment, Queue and member login are blocked.");
    return;
  }

  if (command === "revoke-sessions") {
    await revokeAllSessions(null, reason);
    console.log("[SCENOVA] All previous sessions invalidated.");
    return;
  }

  if (command === "restore") {
    if (arg("confirm") !== "RESTORE_SCENOVA") throw new Error("RESTORE_CONFIRMATION_REQUIRED: use --confirm=RESTORE_SCENOVA after rotating compromised keys and verifying the incident");
    const state = await restoreEmergencyState(null, reason);
    console.log(`[SCENOVA] Emergency controls restored. environmentHardLock=${state.environmentHardLock}`);
    if (state.environmentHardLock) console.log("Environment hard lock is still active; remove SCENOVA_EMERGENCY_LOCKDOWN/SCENOVA_GENERATION_KILL_SWITCH at the deployment platform before provider calls can resume.");
    return;
  }

  throw new Error("Unknown command. Use: status | lockdown | revoke-sessions | restore");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
