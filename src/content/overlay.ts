import Tab from "./tab";

export default class Overlay {
  clickables: Node[] = [];
  clickableType: "click" | "copy" | null = null;

  inViewport(node: HTMLElement): boolean {
    const bounding = node.getBoundingClientRect();

    // If all four of the corners are covered by another element that's not a parent, no need to show
    if (
      !node.contains(document.elementFromPoint(bounding.left + 1, bounding.top + 1)) &&
      !node.contains(document.elementFromPoint(bounding.right - 1, bounding.top + 1)) &&
      !node.contains(document.elementFromPoint(bounding.left + 1, bounding.bottom - 1)) &&
      !node.contains(document.elementFromPoint(bounding.right - 1, bounding.bottom - 1)) &&
      !document.elementFromPoint(bounding.left + 1, bounding.top + 1)?.contains(node) &&
      !document.elementFromPoint(bounding.right - 1, bounding.top + 1)?.contains(node) &&
      !document.elementFromPoint(bounding.left + 1, bounding.bottom - 1)?.contains(node) &&
      !document.elementFromPoint(bounding.right - 1, bounding.bottom - 1)?.contains(node)
    ) {
      return false;
    }

    // Check that this is in the viewport and has some dimensions
    return (
      ((bounding.top >= 0 && bounding.top <= window.innerHeight) ||
        (bounding.bottom >= 0 && bounding.bottom <= window.innerHeight)) &&
      ((bounding.left >= 0 && bounding.left <= window.innerWidth) ||
        (bounding.right >= 0 && bounding.right <= window.innerWidth)) &&
      !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length)
    );
  }

  public nodesMatching(path?: string, overlayType?: string): Node[] {
    const result: Node[] = [];
    if (path && path.length) {
      // Look for elements with matching containing text, input elements with matching placeholder text, or img elements
      // with matching alt text.
      const snapshot = document.evaluate(
        `.//*[not(self::script)][not(self::noscript)][not(self::title)][not(self::meta)][not(self::svg)][not(self::style)][text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${path}')]]|//input[contains(translate(@placeholder, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${path}')]|//img[contains(translate(@alt, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${path}')]`,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      const re = new RegExp("\\b" + path.split(" ").join("\\s*\\b") + "\\b", "i");
      for (let i = 0; i < snapshot.snapshotLength; i++) {
        const item = snapshot.snapshotItem(i);
        if (
          item !== null &&
          this.inViewport(item as HTMLElement) &&
          (item as HTMLElement).innerText.match(re)
        ) {
          result.push(item);
        }
      }
    } else {
      // If no path, then look for all clickable or input elements
      let selectors =
        'input, textarea, div[contenteditable], [role="checkbox"], [role="radio"], .CodeMirror';
      if (overlayType === "links") {
        selectors = 'a, button, summary, [role="link"], [role="button"]';
      } else if (overlayType === "code") {
        selectors = "pre, code";
      }
      const elements = document.querySelectorAll(selectors);
      for (let i = 0; i < elements.length; i++) {
        let element = elements[i] as HTMLElement;
        if (element.tagName == "A" && element.firstElementChild?.tagName == "DIV") {
          element = element.firstElementChild as HTMLElement;
        }
        if (this.inViewport(element)) {
          // if the parent is a pre or code, don't add
          if (
            overlayType === "code" &&
            elements[i].parentElement &&
            ["PRE", "CODE"].includes(elements[i].parentElement!.tagName)
          ) {
            continue;
          }

          result.push(element);
        }
      }
    }
    return result;
  }

  public clearOverlays() {
    const overlays = document.getElementsByClassName("serenade-overlay");
    while (overlays[0]) {
      overlays[0].parentNode!.removeChild(overlays[0]);
    }
    this.clickables = [];
    this.clickableType = null;
  }

  public showOverlay(path: string, overlayType?: string) {
    this.showOverlayForPath(path, overlayType);
    this.clickableType = overlayType === "code" ? "copy" : "click";
  }

  public showOverlayForPath(path: string, overlayType?: string) {
    let counter = 1;
    const bodyRect = (document.body.parentNode! as HTMLElement).getBoundingClientRect();
    this.clickables = this.nodesMatching(path, overlayType);
    for (let i = 0; i < this.clickables.length; i++) {
      const elementRect = (this.clickables[i] as HTMLElement).getBoundingClientRect();
      const overlay = document.createElement("div");
      overlay.innerHTML = (i + 1).toString();
      overlay.className = "serenade-overlay";
      overlay.style.position = "absolute";
      overlay.style.zIndex = "9999";
      overlay.style.top = elementRect.top - bodyRect.top + "px";
      overlay.style.left = elementRect.left - bodyRect.left + "px";
      overlay.style.padding = "3px";
      overlay.style.textAlign = "center";
      overlay.style.color = "#e6ecf2";
      overlay.style.background = "#1c1c16";
      overlay.style.border = "1px solid #e6ecf2";
      overlay.style.borderRadius = "3px";
      overlay.style.opacity = "0.8";
      overlay.style.fontFamily =
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif';

      document.body.appendChild(overlay);
    }
  }

  public click(path: string) {
    const pathNumber = parseInt(path, 10);
    // If we are clicking a text path
    if (this.clickables.length === 0 || isNaN(pathNumber)) {
      this.showOverlayForPath(path);
      // auto-execute
      if (this.clickables.length === 1) {
        const node = this.clickables[0];
        if ((node as HTMLElement).className.includes("CodeMirror")) {
          (node as HTMLElement).getElementsByTagName("textarea")[0].focus();
          (node as HTMLElement).getElementsByTagName("textarea")[0].click();
        } else {
          (node as HTMLElement).focus();
          (node as HTMLElement).click();
        }
        this.clearOverlays();
        return;
      } else {
        this.clickableType = "click";
        return;
      }
    }

    // If we have a number that we can click
    if (pathNumber - 1 < this.clickables.length) {
      const node = this.clickables[pathNumber - 1];
      if ((node as HTMLElement).className.includes("CodeMirror")) {
        (node as HTMLElement).getElementsByTagName("textarea")[0].focus();
        (node as HTMLElement).getElementsByTagName("textarea")[0].click();
      } else {
        (node as HTMLElement).focus();
        (node as HTMLElement).click();
      }
    }
    this.clearOverlays();
  }

  public async copyClickable(index: number): Promise<boolean> {
    // 0-index
    index = index - 1;
    if (index >= this.clickables.length) {
      return false;
    }

    const text = Tab.transformer.getSource(this.clickables[index] as HTMLElement);
    if (text === null) {
      return false;
    } else {
      return await navigator.clipboard
        .writeText(text)
        .then(() => {
          Tab.notifications.show(`Copied ${index}`);
          this.clearOverlays();
          return true;
        })
        .catch(() => {
          Tab.notifications.show(`Failed to copy ${index}. Please focus Chrome.`);
          return true;
        });
    }
  }
}
