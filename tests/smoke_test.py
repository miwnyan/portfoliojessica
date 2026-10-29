from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4173"
ARTIFACTS = Path(__file__).parent / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)


def main() -> None:
    browser_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda error: browser_errors.append(f"pageerror: {error}"))
        page.on(
            "console",
            lambda message: browser_errors.append(f"console.{message.type}: {message.text}")
            if message.type == "error"
            else None,
        )

        page.goto(BASE_URL, wait_until="domcontentloaded")
        page.locator("#projects-grid .circular-carousel").wait_for(state="visible")

        assert page.locator("#projects-grid [data-cc-index]").count() == 4
        assert page.locator("#skills-grid .skill-folder").count() == 3
        assert page.locator("#skills-grid [data-skill-id]").count() == 18
        assert page.locator("#experience-timeline .timeline-item").count() == 2
        assert page.locator("#experience-toggle").is_hidden()
        assert page.locator('a[href="/admin"], a[href="/admin/"]').count() == 0

        page.locator('#skills-grid [data-skill-id="azure"]').click()
        page.locator("#skill-dialog[open]").wait_for(state="visible")
        assert page.locator("#skill-modal-title").inner_text().strip()
        assert page.locator("#skill-modal-certificate").is_visible()
        assert "azure-fundamentals" in page.locator("#skill-modal-certificate").get_attribute("src")
        page.screenshot(path=str(ARTIFACTS / "certificate-modal.png"), full_page=False)
        page.locator("#skill-modal-close").click()

        page.locator("#projects-grid .projects-carousel__actions button").click()
        page.locator("#project-dialog[open]").wait_for(state="visible")
        assert page.locator("#modal-title").inner_text().strip()
        page.locator("#modal-close").click()

        first_folder = page.locator("#skills-grid [data-folder-toggle]").first
        first_folder.click()
        assert page.locator("#skills-grid .skill-folder").first.evaluate("element => element.classList.contains('is-closing')")
        page.wait_for_timeout(220)
        page.screenshot(path=str(ARTIFACTS / "folder-closing.png"), full_page=False)
        page.wait_for_timeout(480)
        assert first_folder.get_attribute("aria-expanded") == "false"
        first_folder.click()
        assert first_folder.get_attribute("aria-expanded") == "true"

        bunny = page.locator("#bunny-interaction")
        original_bunny_src = page.locator("#bunny-image").get_attribute("src")
        bunny.click()
        assert bunny.evaluate("element => element.classList.contains('is-reacting')")
        page.wait_for_timeout(180)
        assert page.locator("#bunny-reaction").count() == 0
        assert page.locator("#bunny-image").get_attribute("src") == original_bunny_src
        assert bunny.evaluate("element => getComputedStyle(element).transform !== 'none'")

        for section in ["#sobre", "#skills-grid", "#experience-timeline", "#projetos", "#contato"]:
            page.locator(section).scroll_into_view_if_needed()
            page.wait_for_timeout(80)
        page.evaluate("window.scrollTo(0, 0)")
        page.screenshot(path=str(ARTIFACTS / "portfolio-desktop.png"), full_page=True)

        mobile = browser.new_page(viewport={"width": 390, "height": 844})
        mobile.goto(BASE_URL, wait_until="domcontentloaded")
        mobile.locator("#projects-grid .circular-carousel").wait_for(state="visible")
        mobile.locator("#menu-toggle").click()
        assert mobile.locator("#site-nav").evaluate("element => element.classList.contains('open')")
        for section in ["#sobre", "#skills-grid", "#experience-timeline", "#projetos", "#contato"]:
            mobile.locator(section).scroll_into_view_if_needed()
            mobile.wait_for_timeout(80)
        mobile.evaluate("window.scrollTo(0, 0)")
        mobile.screenshot(path=str(ARTIFACTS / "portfolio-mobile.png"), full_page=True)

        admin = browser.new_page(viewport={"width": 1440, "height": 1000})
        admin.on("pageerror", lambda error: browser_errors.append(f"admin pageerror: {error}"))
        admin.on(
            "console",
            lambda message: browser_errors.append(f"admin console.{message.type}: {message.text}")
            if message.type == "error"
            else None,
        )
        admin.goto(f"{BASE_URL}/admin", wait_until="domcontentloaded")
        admin.locator("#login-view:not([hidden]), #setup-view:not([hidden]), #admin-app:not([hidden])").first.wait_for(
            state="visible", timeout=15_000
        )
        if admin.locator("#login-view").is_visible():
            assert admin.locator("#login-email").is_visible()
            assert admin.locator("#login-password").is_visible()
            assert admin.locator('input[name="signup"]').count() == 0
        admin.screenshot(path=str(ARTIFACTS / "admin-entry.png"), full_page=True)

        browser.close()

    if browser_errors:
        raise AssertionError("Browser errors:\n" + "\n".join(browser_errors))

    print("Smoke tests passed")


if __name__ == "__main__":
    main()
