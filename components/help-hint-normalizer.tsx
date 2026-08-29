"use client";

import { useEffect } from "react";

/*
 * Global SCENOVA help normalizer.
 *
 * /profile/api is the canonical interaction: a small circular info icon opens a
 * themed popover containing a bold label and a concise explanation. This
 * normalizer applies that same pattern to existing helper copy throughout the
 * app without forcing every legacy workspace to implement its own tooltip.
 */

const HELP_SELECTOR = [
  "small",
  "[data-sc-help]",
  "[class*='_help__']",
  "[class*='_Help__']",
  "[class*='_hint__']",
  "[class*='_Hint__']",
  "[class*='_helper__']",
  "[class*='_Helper__']",
  "[class*='_description__']",
  "[class*='_Description__']",
  "[class*='panelHeader'] > p",
  "[class*='cardHead'] p",
  "[class*='cardTitle'] p",
  "[class*='sectionHead'] p",
  "[class*='sectionHeading'] > p",
  "[class*='menuCopy'] > span:last-child",
].join(",");

const SKIP_SELECTOR = [
  "[data-keep-small]",
  "[data-sc-help-ignore]",
  "[data-sc-sidebar]",
  "[data-sc-topbar]",
  ".sc-system-info-trigger",
  ".sc-system-info-popover",
  "[class*='brand']",
  "[class*='metric']",
  "[class*='badge']",
  "[class*='status']",
  "[class*='meta']",
  "[class*='tag']",
  "[class*='timestamp']",
  "[class*='date']",
  "[class*='price']",
  "[class*='logRow']",
  "[class*='profileCopy']",
  "[class*='creditShortcut']",
  "[class*='setupBox']",
  "[class*='recoveryCode']",
  "code",
  "pre",
].join(",");

const LABEL_SELECTOR = "h1,h2,h3,h4,h5,h6,strong,b,summary,label";
const POPOVER_ID = "sc-system-info-popover";

function compactText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function descriptionFor(element: HTMLElement) {
  return compactText(element.dataset.scHelp || element.textContent);
}

function labelFor(element: HTMLElement, description: string) {
  const explicit = compactText(element.dataset.scHelpLabel);
  if (explicit) return explicit;

  const previous = element.previousElementSibling;
  if (previous instanceof HTMLElement && previous.matches(LABEL_SELECTOR)) {
    const text = compactText(previous.textContent);
    if (text && text !== description) return text;
  }

  const parent = element.parentElement;
  if (parent) {
    const local = parent.querySelector<HTMLElement>(LABEL_SELECTOR);
    const text = compactText(local?.textContent);
    if (text && text !== description) return text;
  }

  const container = element.closest<HTMLElement>(
    "section,article,header,[class*='card'],[class*='panel'],[class*='section'],[class*='row'],[class*='item']",
  );
  if (container) {
    const heading = container.querySelector<HTMLElement>(LABEL_SELECTOR);
    const text = compactText(heading?.textContent);
    if (text && text !== description) return text;
  }

  return description.length > 54 ? `${description.slice(0, 51).trim()}…` : description;
}

function makeInfoIcon() {
  const trigger = document.createElement("span");
  trigger.className = "sc-system-info-trigger";
  trigger.setAttribute("role", "button");
  trigger.setAttribute("tabindex", "0");
  trigger.setAttribute("aria-haspopup", "true");
  trigger.dataset.open = "false";
  trigger.innerHTML = [
    '<svg viewBox="0 0 24 24" aria-hidden="true">',
    '<circle cx="12" cy="12" r="9"></circle>',
    '<path d="M12 10.5v6"></path>',
    '<path d="M12 7.5h.01"></path>',
    "</svg>",
  ].join("");
  return trigger;
}

function findAnchor(element: HTMLElement) {
  const previous = element.previousElementSibling;
  if (previous instanceof HTMLElement && previous.matches(LABEL_SELECTOR)) return previous;

  const parent = element.parentElement;
  if (parent) {
    const local = parent.querySelector<HTMLElement>(LABEL_SELECTOR);
    if (local && local !== element && !local.contains(element)) return local;
  }

  const container = element.closest<HTMLElement>(
    "section,article,header,[class*='card'],[class*='panel'],[class*='section'],[class*='item']",
  );
  const heading = container?.querySelector<HTMLElement>(LABEL_SELECTOR);
  if (heading && heading !== element && !heading.contains(element)) return heading;

  return element;
}

function alreadyHasDirectInfo(anchor: HTMLElement) {
  return Array.from(anchor.children).some((child) => child.classList.contains("sc-system-info-trigger"));
}

export default function HelpHintNormalizer() {
  useEffect(() => {
    const popover = document.createElement("div");
    popover.id = POPOVER_ID;
    popover.className = "sc-system-info-popover";
    popover.setAttribute("role", "tooltip");
    popover.setAttribute("aria-hidden", "true");
    popover.dataset.open = "false";

    const popoverTitle = document.createElement("strong");
    const popoverDescription = document.createElement("span");
    popover.append(popoverTitle, popoverDescription);
    document.body.appendChild(popover);

    let activeTrigger: HTMLElement | null = null;

    function positionPopover() {
      if (!activeTrigger || popover.dataset.open !== "true") return;

      const triggerRect = activeTrigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 8;

      let left = triggerRect.right - popoverRect.width;
      left = Math.max(
        viewportPadding,
        Math.min(left, window.innerWidth - popoverRect.width - viewportPadding),
      );

      let top = triggerRect.bottom + gap;
      if (top + popoverRect.height > window.innerHeight - viewportPadding) {
        top = triggerRect.top - popoverRect.height - gap;
      }
      top = Math.max(
        viewportPadding,
        Math.min(top, window.innerHeight - popoverRect.height - viewportPadding),
      );

      popover.style.left = `${Math.round(left)}px`;
      popover.style.top = `${Math.round(top)}px`;
    }

    function hidePopover() {
      if (activeTrigger) {
        activeTrigger.dataset.open = "false";
        activeTrigger.setAttribute("aria-expanded", "false");
      }
      popover.dataset.open = "false";
      popover.setAttribute("aria-hidden", "true");
      activeTrigger = null;
    }

    function showPopover(trigger: HTMLElement, source: HTMLElement) {
      const description = source.dataset.scHelpDescription || descriptionFor(source);
      if (!description) return;
      const label = source.dataset.scHelpLabelResolved || labelFor(source, description);

      if (activeTrigger && activeTrigger !== trigger) {
        activeTrigger.dataset.open = "false";
        activeTrigger.setAttribute("aria-expanded", "false");
      }

      activeTrigger = trigger;
      popoverTitle.textContent = label;
      popoverDescription.textContent = description;
      trigger.dataset.open = "true";
      trigger.setAttribute("aria-expanded", "true");
      popover.dataset.open = "true";
      popover.setAttribute("aria-hidden", "false");
      popover.style.left = "12px";
      popover.style.top = "12px";
      requestAnimationFrame(positionPopover);
    }

    function enhance(element: Element) {
      if (!(element instanceof HTMLElement)) return;
      if (element.dataset.scHelpReady === "1") return;
      if (element.matches(SKIP_SELECTOR) || element.closest(SKIP_SELECTOR)) return;

      const description = descriptionFor(element);
      if (!description || description.length < 4) return;

      const label = labelFor(element, description);
      let anchor = findAnchor(element);
      if (alreadyHasDirectInfo(anchor)) anchor = element;
      const trigger = makeInfoIcon();

      trigger.setAttribute("aria-label", `คำอธิบาย: ${label}`);
      trigger.setAttribute("aria-describedby", POPOVER_ID);
      trigger.setAttribute("aria-expanded", "false");

      element.dataset.scHelpReady = "1";
      element.dataset.scHelpDescription = description;
      element.dataset.scHelpLabelResolved = label;
      element.classList.add("sc-help-source-linked");
      if (!element.hasAttribute("title")) element.setAttribute("title", description);

      anchor.classList.add("sc-help-anchor");
      anchor.appendChild(trigger);

      trigger.addEventListener("mouseenter", () => showPopover(trigger, element));
      trigger.addEventListener("mouseleave", hidePopover);
      trigger.addEventListener("focus", () => showPopover(trigger, element));
      trigger.addEventListener("blur", hidePopover);
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (activeTrigger === trigger && popover.dataset.open === "true") hidePopover();
        else showPopover(trigger, element);
      });
      trigger.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          if (activeTrigger === trigger && popover.dataset.open === "true") hidePopover();
          else showPopover(trigger, element);
        } else if (event.key === "Escape") {
          hidePopover();
        }
      });
    }

    function scan(root: ParentNode) {
      if (root instanceof Element && root.matches(HELP_SELECTOR)) enhance(root);
      root.querySelectorAll(HELP_SELECTOR).forEach(enhance);
    }

    scan(document);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches(".sc-system-info-trigger,.sc-system-info-popover")) return;
          scan(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const reposition = () => {
      if (activeTrigger) requestAnimationFrame(positionPopover);
    };
    const outsidePointer = (event: PointerEvent) => {
      if (!activeTrigger) return;
      const target = event.target;
      if (target instanceof Node && activeTrigger.contains(target)) return;
      hidePopover();
    };

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", outsidePointer);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", outsidePointer);
      popover.remove();
    };
  }, []);

  return null;
}
