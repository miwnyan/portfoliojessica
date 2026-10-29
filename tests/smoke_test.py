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

        page.goto(BASE_URL, wait_until="networkidle")
        page.locator("#projects-grid .circular-carousel").wait_for(state="visible")
        page.wait_for_function(
            "document.querySelector('.text-type__content')?.textContent.includes('Jéssica')"
        )
        assert page.locator("#hero-subtitle").count() == 0
        assert page.locator("#hero-type-root h1").count() == 1
        assert "Jéssica" == "".join(page.locator(".text-type__char--accent").all_inner_texts())
        phrases = page.locator("#hero-type-root .text-type__sr").inner_text()
        assert "Desenvolvo sistemas" in phrases
        assert "Crio automações" in phrases
        assert "Protejo redes e dados" in phrases
        page.wait_for_timeout(5_200)
        assert "Olá, eu sou a Jéssica" in page.locator(".text-type__content").inner_text()

        moon = page.locator("#hero-moon-root .halftone-reveal")
        moon.wait_for(state="visible")
        assert moon.locator("canvas").evaluate("canvas => canvas.width > 0 && canvas.height > 0")
        hero_box = page.locator(".hero-content").bounding_box()
        about_box = page.locator(".about-copy").bounding_box()
        assert hero_box and about_box
        assert abs(hero_box["x"] - about_box["x"]) <= 1
        moon.hover(position={"x": 280, "y": 220})
        page.wait_for_timeout(350)
        page.evaluate("window.scrollTo(0, 0)")
        page.screenshot(path=str(ARTIFACTS / "hero-halftone.png"), full_page=False)

        assert page.locator("#projects-grid [data-cc-index]").count() == 6
        project_labels = page.locator("#projects-grid [data-cc-index]").evaluate_all(
            "elements => elements.map(element => element.getAttribute('aria-label'))"
        )
        assert any("SistemaCafeteria" in label for label in project_labels)
        assert any("SysDaisyOptimizer" in label for label in project_labels)
        project_images = page.locator("#projects-grid .circular-carousel__photo").evaluate_all(
            "images => images.map(image => new URL(image.currentSrc || image.src).pathname)"
        )
        for preview in ["prumo-preview.png", "lastro-preview.png", "cirro-preview.png", "nexo-preview.png"]:
            assert any(path.endswith(preview) for path in project_images)
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

        page.locator("#projects-grid .circular-carousel").focus()
        page.keyboard.press("Enter")
        page.locator("#project-dialog[open]").wait_for(state="visible")
        assert page.locator("#modal-title").inner_text().strip()
        page.locator("#modal-close").click()

        carousel = page.locator("#projects-grid .circular-carousel")
        carousel.hover()
        page.wait_for_timeout(300)
        active_project_index = int(page.locator(".projects-carousel__counter span").first.inner_text()) - 1
        first_project = page.locator(f'#projects-grid [data-cc-index="{active_project_index}"]')
        first_project.locator(".circular-carousel__tile").first.hover(force=True)
        page.wait_for_timeout(220)
        assert first_project.locator(".circular-carousel__action").evaluate(
            "element => getComputedStyle(element.parentElement).opacity === '1'"
        )
        assert first_project.locator(".circular-carousel__action").get_attribute("href")
        page.screenshot(path=str(ARTIFACTS / "project-hover.png"), full_page=False)

        first_folder = page.locator("#skills-grid [data-folder-toggle]").first
        second_folder = page.locator("#skills-grid [data-folder-toggle]").nth(1)
        page.locator("#skills-grid [data-skill-id]").first.hover()
        assert page.locator("#skills-grid .folder-paper").first.evaluate(
            "element => getComputedStyle(element, '::before').content === 'none'"
        )
        first_folder.click()
        assert page.locator("#skills-grid .skill-folder").first.evaluate("element => element.classList.contains('is-closing')")
        second_folder.click()
        assert not page.locator("#skills-grid .skill-folder").nth(1).evaluate(
            "element => element.classList.contains('is-closing')"
        )
        page.wait_for_timeout(220)
        page.screenshot(path=str(ARTIFACTS / "folder-closing.png"), full_page=False)
        page.wait_for_timeout(460)
        assert first_folder.get_attribute("aria-expanded") == "false"
        page.wait_for_timeout(40)
        assert page.locator("#skills-grid .skill-folder").nth(1).evaluate(
            "element => element.classList.contains('is-closing')"
        )
        page.wait_for_timeout(620)
        assert second_folder.get_attribute("aria-expanded") == "false"
        first_folder.click()
        page.wait_for_timeout(650)
        assert first_folder.get_attribute("aria-expanded") == "true"

        bunny = page.locator("#bunny-interaction")
        assert page.locator(".bunny-hint").count() == 0
        original_bunny_src = page.locator("#bunny-image").get_attribute("src")
        assert "coelhinho-estatico.png" in original_bunny_src
        assert page.locator(".bunny-picture").evaluate(
            "element => getComputedStyle(element).animationName === 'bunnyBreathe'"
        )
        bunny.evaluate("element => element.dataset.reactionDuration = '450'")
        bunny.click()
        assert bunny.evaluate("element => element.classList.contains('is-reacting')")
        assert "coelhinho.gif" in page.locator("#bunny-image").get_attribute("src")
        assert page.locator(".bunny-picture").evaluate(
            "element => getComputedStyle(element).animationName === 'none'"
        )
        page.wait_for_timeout(520)
        assert not bunny.evaluate("element => element.classList.contains('is-reacting')")
        assert "coelhinho-estatico.png" in page.locator("#bunny-image").get_attribute("src")

        page.route(
            "**/api/contact",
            lambda route: route.fulfill(status=200, content_type="application/json", body='{"ok":true}'),
        )
        page.locator("#contact-name").fill("Visitante")
        page.locator("#contact-email").fill("visitante@example.com")
        page.locator("#contact-message").fill("Olá, gostaria de conversar sobre um projeto.")
        page.locator("#contact-submit").click()
        page.locator("#contact-status.is-success").wait_for(state="visible")
        assert "Mensagem enviada" in page.locator("#contact-status").inner_text()
        assert page.locator("#contact-message").input_value() == ""
        assert page.locator("#contact-message").evaluate("element => getComputedStyle(element).resize === 'none'")

        hero_title_box = page.locator("#hero-type-root h1").bounding_box()
        hero_description_box = page.locator("#hero-description").bounding_box()
        assert hero_title_box and hero_description_box
        assert abs(hero_title_box["x"] - hero_description_box["x"]) <= 1

        for section in ["#sobre", "#skills-grid", "#experience-timeline", "#projetos", "#contato"]:
            page.locator(section).scroll_into_view_if_needed()
            page.wait_for_timeout(80)
        page.evaluate("window.scrollTo(0, 0)")
        page.screenshot(path=str(ARTIFACTS / "portfolio-desktop.png"), full_page=True)

        mobile = browser.new_page(viewport={"width": 390, "height": 844})
        mobile.goto(BASE_URL, wait_until="networkidle")
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
        admin.goto(f"{BASE_URL}/admin", wait_until="networkidle")
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
