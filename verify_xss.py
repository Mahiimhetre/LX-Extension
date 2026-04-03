from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    cwd = os.getcwd()
    # Intercept and block external requests to prevent timeouts
    page.route("**/*", lambda route: route.abort() if route.request.url.startswith("http") else route.continue_())

    page.goto(f"file://{cwd}/src/ui/sidepanel/panel.html", wait_until="commit")

    page.wait_for_selector("body")
    page.wait_for_timeout(500)

    # Inject the script directly to trigger the notification since clicking the button might not work if UI is not fully bound due to missing local dev server
    page.evaluate('''() => {
        if (LocatorX && LocatorX.notifications) {
            LocatorX.notifications.show("<script>alert('xss')</script> This should be escaped");
            LocatorX.notifications.undoable("<img src=x onerror=alert(1)> This should also be escaped");
        }
    }''')

    # Wait for notification
    page.wait_for_selector('.notification')
    page.wait_for_timeout(500)

    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()