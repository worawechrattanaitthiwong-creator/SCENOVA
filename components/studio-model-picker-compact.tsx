"use client";

export default function StudioModelPickerCompact() {
  return (
    <style>{`
      /* Keep the approved AI picker, but make it align with the standard Studio fields. */
      .sc-ai-model-field > span:first-child {
        display: none !important;
      }

      .sc-ai-model-picker-shell {
        gap: 8px !important;
      }

      .sc-ai-picker-label {
        margin-bottom: 6px !important;
        font-size: 11px !important;
        line-height: 1.2 !important;
      }

      .sc-ai-select-trigger {
        height: 53px !important;
        min-height: 53px !important;
        padding: 6px 10px !important;
        gap: 7px !important;
        border-radius: 10px !important;
      }

      .sc-brand-icon.is-large {
        width: 27px !important;
        height: 27px !important;
        flex: 0 0 27px !important;
        border-radius: 8px !important;
      }

      .sc-ai-status-dot {
        width: 8px !important;
        height: 8px !important;
        flex-basis: 8px !important;
        box-shadow: 0 0 0 3px color-mix(in srgb,currentColor 10%,transparent),0 0 10px currentColor !important;
      }

      .sc-ai-select-copy strong {
        font-size: 13px !important;
        line-height: 1.2 !important;
      }

      .sc-ai-select-copy small {
        margin-top: 2px !important;
        font-size: 8.5px !important;
        line-height: 1.2 !important;
      }

      .sc-ai-select-chevron {
        font-size: 19px !important;
      }

      .sc-ai-lock {
        width: 16px !important;
        height: 16px !important;
      }

      @media (max-width: 820px) {
        .sc-ai-model-field > span:first-child {
          display: block !important;
        }
      }
    `}</style>
  );
}
