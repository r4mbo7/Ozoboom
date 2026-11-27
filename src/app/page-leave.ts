export interface PageLeave {
  readonly online: { readonly active: boolean; leave(): void };
  // A page the browser kept for its back button shows again, after it left an online session.
  restored(): void;
}

type PageTarget = Pick<Window, 'addEventListener'>;

// Closing the tab tells the others at once, instead of leaving them to wait for a timeout. A page
// the browser keeps for its back button leaves too: a game in lockstep cannot wait for it.
export function watchPageLeave(target: PageTarget, page: PageLeave): void {
  let left = false;
  target.addEventListener('pagehide', () => {
    left = page.online.active;
    page.online.leave();
  });
  target.addEventListener('pageshow', (event) => {
    if (event.persisted && left) {
      left = false;
      page.restored();
    }
  });
}
