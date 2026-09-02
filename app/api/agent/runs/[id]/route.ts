import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { getAgentRunDetails } from "@/lib/agent/store";
import { getWorkflowSnapshot } from "@/lib/agent/workflow-store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const details = await getAgentRunDetails(id, user.id);
  if (!details) return NextResponse.json({ error: "AGENT_RUN_NOT_FOUND" }, { status: 404 });
  const workflow = await getWorkflowSnapshot(id);
  const generations = details.videoGenerations || [];
  const systemGenerations = generations.filter((generation) => generation.billingMode === "SYSTEM");
  const settledSystem = systemGenerations.filter((generation) => generation.status === "SETTLED");
  const providerCostThb = settledSystem.reduce((sum, generation) => sum + Number(generation.estimatedProviderCost || 0), 0);
  const chargedCredits = settledSystem.reduce((sum, generation) => sum + Number(generation.reservedCredits || 0), 0);
  const creditsPerThb = Math.max(0.01, Number(process.env.SCENOVA_CREDITS_PER_THB || 1));
  const revenueThb = chargedCredits / creditsPerThb;
  const llmCostThb = details.llmUsage.reduce((sum, item) => sum + Number(item.costThb || 0), 0);
  const hasByok = generations.some((generation) => generation.billingMode === "BYOK");
  return NextResponse.json({ ...details, workflow, costSummary: {
    providerCostThb, llmCostThb, totalCostThb: providerCostThb + llmCostThb,
    chargedCredits, creditsPerThb, revenueThb, grossProfitThb: revenueThb - providerCostThb - llmCostThb,
    note: hasByok && chargedCredits === 0
      ? "งานนี้ใช้ BYOK: SCENOVA ไม่หัก Wallet และค่า Provider จะอยู่ในบัญชี API ของคุณโดยตรง"
      : "ต้นทุน Provider ใช้ยอดที่บันทึกใน Generation; หาก Provider คิดเงินภายนอก SCENOVA ต้องตรวจใบแจ้งหนี้ Provider เพิ่มเติม",
  } });
}
