"use client";

export default function StudioModelPickerCompact() {
  return (
    <style>{`
      /* Visual-only alignment for the approved AI model/version picker.
         Keep the original native select/state logic untouched. */
      .sc-ai-model-field > span:first-child {
        display: none !important;
      }

      .sc-ai-model-picker-shell {
        gap: 8px !important;
        align-items: end !important;
      }

      .sc-ai-picker-label {
        margin-bottom: 6px !important;
        font-size: 11px !important;
        line-height: 1.2 !important;
      }

      /* Standard Studio inputs are ~54px tall. Force the complete picker box,
         including padding + border, to the same height. */
      .sc-ai-select-trigger {
        box-sizing: border-box !important;
        width: 100% !important;
        height: 54px !important;
        min-height: 54px !important;
        max-height: 54px !important;
        padding: 5px 10px !important;
        gap: 7px !important;
        border-radius: 10px !important;
        overflow: hidden !important;
      }

      .sc-brand-icon.is-large {
        box-sizing: border-box !important;
        width: 24px !important;
        height: 24px !important;
        min-width: 24px !important;
        flex: 0 0 24px !important;
        border-radius: 7px !important;
      }

      .sc-ai-status-dot {
        width: 7px !important;
        height: 7px !important;
        min-width: 7px !important;
        flex: 0 0 7px !important;
        box-shadow: 0 0 0 3px color-mix(in srgb,currentColor 10%,transparent),0 0 9px currentColor !important;
      }

      .sc-ai-select-copy {
        min-width: 0 !important;
        line-height: 1 !important;
      }

      .sc-ai-select-copy strong {
        font-size: 13px !important;
        line-height: 1.15 !important;
      }

      .sc-ai-select-copy small {
        margin-top: 2px !important;
        font-size: 8.5px !important;
        line-height: 1.05 !important;
      }

      .sc-ai-select-chevron {
        flex: 0 0 auto !important;
        font-size: 18px !important;
        line-height: 1 !important;
      }

      .sc-ai-lock {
        width: 15px !important;
        height: 15px !important;
        flex: 0 0 15px !important;
      }

      @media (max-width: 820px) {
        .sc-ai-model-field > span:first-child {
          display: block !important;
        }
      }
    `}</style>
  );
}
