from pathlib import Path
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5173"
ARTIFACTS = Path(__file__).parent / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)


def wait_for_chat(page):
    page.goto(BASE_URL, wait_until="networkidle")
    page.locator(".chat-launcher").wait_for(state="visible", timeout=10000)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    errors = []

    desktop = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    desktop.on("pageerror", lambda error: errors.append(str(error)))
    chat_requests = []
    desktop.on("request", lambda request: chat_requests.append(request.url) if "/api/chat" in request.url else None)
    wait_for_chat(desktop)

    desktop.get_by_role("button", name="Abrir assistente virtual").click()
    desktop.locator(".portfolio-chat.is-open").wait_for()
    desktop.get_by_text("Oi! Eu sou a Nyan.").wait_for()
    desktop.wait_for_timeout(550)
    assert desktop.locator(".chat-mini-orb canvas").count() == 1
    assert desktop.locator(".chat-launcher-orb canvas").count() == 1
    assert desktop.locator(".chat-avatar").count() == 0
    desktop.screenshot(path=str(ARTIFACTS / "chat-desktop.png"))

    desktop.get_by_role("button", name="Ver projetos", exact=True).click()
    desktop.get_by_text("Os projetos em destaque são", exact=False).wait_for(timeout=8000)
    assert not chat_requests, "Uma resposta predefinida não deveria consumir a API da Groq."

    desktop.get_by_role("button", name="Marcar conversa").click()
    assert desktop.get_by_role("button", name="Desmarcar conversa").get_attribute("aria-pressed") == "true"
    desktop.get_by_role("button", name="Nova conversa").click()
    desktop.get_by_role("button", name="Ver conversas").click()
    desktop.get_by_text("Marcada", exact=True).wait_for()
    desktop.get_by_role("button", name="Ver conversas").click()

    desktop.get_by_role("dialog", name="Assistente virtual do portfólio").get_by_role("button", name="Enviar mensagem", exact=True).click()
    desktop.get_by_role("heading", name="Enviar mensagem").wait_for()
    assert desktop.locator("#chat-contact-email").get_attribute("type") == "email"
    desktop.screenshot(path=str(ARTIFACTS / "chat-contact.png"))
    desktop.get_by_role("button", name="Voltar à conversa").click()

    identity_requests = len(chat_requests)
    desktop.locator("#portfolio-chat-input").fill("O que é Nyan?")
    with desktop.expect_response(lambda response: "/api/chat" in response.url, timeout=20000) as response_info:
        desktop.get_by_role("button", name="Enviar pergunta").click()
        desktop.locator(".chat-mini-orb.is-active").wait_for(timeout=3000)
        assert "chatOrbListening" in desktop.locator(".chat-mini-orb.is-active").evaluate("element => getComputedStyle(element).animationName")
        desktop.screenshot(path=str(ARTIFACTS / "chat-orb-active.png"))
    identity_result = response_info.value.json()
    assert identity_result["ok"] is True
    assert identity_result["source"] == "portfolio"
    assert "Nyan" in identity_result["answer"] and "assistente virtual" in identity_result["answer"]
    desktop.get_by_text(identity_result["answer"], exact=True).wait_for(timeout=10000)
    assert len(chat_requests) > identity_requests, "A pergunta sobre a Nyan deveria chegar à API."
    assert desktop.get_by_text("As conversas ficam salvas somente neste dispositivo.").count() == 0

    desktop.locator("#portfolio-chat-input").fill("A Jéssica possui disponibilidade imediata para projetos internacionais?")
    desktop.get_by_role("button", name="Enviar pergunta").click()
    desktop.get_by_text("Não encontrei essa informação no portfólio.", exact=False).wait_for(timeout=10000)
    assert chat_requests, "Uma dúvida não predefinida deveria chamar /api/chat."

    desktop.get_by_role("button", name="Nova conversa").click()
    requests_before_link = len(chat_requests)
    desktop.locator("#portfolio-chat-input").fill("linkedin")
    desktop.get_by_role("button", name="Enviar pergunta").click()
    linkedin = desktop.locator('.chat-bubble a[href="https://www.linkedin.com/in/jessicamontessantos"]')
    linkedin.wait_for(timeout=8000)
    assert len(chat_requests) == requests_before_link, "Um pedido simples de LinkedIn deveria ser respondido localmente."

    desktop.get_by_role("button", name="Nova conversa").click()
    desktop.locator("#portfolio-chat-input").fill("a")
    desktop.get_by_role("button", name="Enviar pergunta").click()
    desktop.get_by_text("Não consegui entender ainda.", exact=False).wait_for(timeout=8000)

    sent_contact = {}
    chat_requests_before_contact = len(chat_requests)
    def mock_contact(route):
        sent_contact.update(route.request.post_data_json)
        route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
    desktop.route("**/api/contact", mock_contact)
    desktop.get_by_role("button", name="Nova conversa").click()
    desktop.locator("#portfolio-chat-input").fill("Quero falar com a Jéssica")
    desktop.get_by_role("button", name="Enviar pergunta").click()
    desktop.get_by_text("O que você gostaria de dizer", exact=False).wait_for(timeout=8000)
    desktop.locator("#portfolio-chat-input").fill("Gostaria de conversar sobre um novo site")
    desktop.get_by_role("button", name="Enviar pergunta").click()
    desktop.get_by_text("Qual e-mail", exact=False).wait_for(timeout=8000)
    desktop.locator("#portfolio-chat-input").fill("teste@example.com")
    desktop.get_by_role("button", name="Enviar pergunta").click()
    desktop.get_by_text("qual é o seu nome", exact=False).wait_for(timeout=8000)
    desktop.locator("#portfolio-chat-input").fill("Miguel")
    desktop.get_by_role("button", name="Enviar pergunta").click()
    desktop.get_by_text("Posso enviar agora?", exact=False).wait_for(timeout=8000)
    with desktop.expect_response(lambda response: "/api/contact" in response.url, timeout=10000) as contact_response:
        desktop.get_by_role("button", name="Enviar agora").click()
    assert contact_response.value.status == 200
    desktop.get_by_text("Mensagem enviada com sucesso.", exact=False).wait_for(timeout=8000)
    assert sent_contact["name"] == "Miguel"
    assert sent_contact["email"] == "teste@example.com"
    assert sent_contact["message"] == "Gostaria de conversar sobre um novo site"
    assert len(chat_requests) == chat_requests_before_contact, "Dados de contato não devem ser enviados à Groq."

    desktop.get_by_role("button", name="Nova conversa").click()
    desktop.locator("#portfolio-chat-input").fill("Eu quero enviar para ela uma mensagem, meu email é direto@example.com, meu nome é Miguel e a mensagem que quero enviar é olá")
    desktop.get_by_role("button", name="Enviar pergunta").click()
    desktop.get_by_text("Nome: Miguel", exact=False).wait_for(timeout=8000)
    desktop.get_by_text("E-mail: direto@example.com", exact=False).wait_for(timeout=8000)
    desktop.get_by_text("Mensagem: olá", exact=False).wait_for(timeout=8000)
    desktop.screenshot(path=str(ARTIFACTS / "chat-conversational-contact.png"))
    desktop.get_by_role("button", name="Cancelar").click()
    desktop.get_by_text("Envio cancelado.", exact=False).wait_for(timeout=8000)

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    mobile.on("pageerror", lambda error: errors.append(str(error)))
    wait_for_chat(mobile)
    mobile.get_by_role("button", name="Abrir assistente virtual").click()
    mobile.locator(".portfolio-chat.is-open").wait_for()
    mobile.wait_for_timeout(550)
    mobile.screenshot(path=str(ARTIFACTS / "chat-mobile.png"))
    dimensions = mobile.evaluate("() => ({ scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth })")
    assert dimensions["scroll"] <= dimensions["viewport"], f"Overflow horizontal no mobile: {dimensions}"

    browser.close()
    assert not errors, "Erros JavaScript encontrados: " + " | ".join(errors)

print("Chatbot UI tests passed")
