# Portfólio — Jéssica

Portfólio em HTML, CSS e JavaScript, agora preparado como uma aplicação Vite multipágina. O site público mantém a interface original e o painel administrativo fica exclusivamente em `/admin`, sem link de acesso na página pública.

O conteúdo editável é persistido no Cloud Firestore, o login usa Firebase Authentication com e-mail e senha, e imagens/GIFs são enviados diretamente do navegador para o Cloudinary. O projeto pode ser publicado tanto na Vercel quanto no Firebase Hosting.

## Recursos do painel

- edição dos textos, metadados, navegação, rodapé, contatos, cores, favicon e coelhinho;
- criação, edição, remoção e reordenação de projetos;
- importação de repositório público do GitHub;
- criação manual de projeto com capa, incluindo GIF;
- edição e reordenação das experiências, com controle para expandir e recolher a lista no site;
- criação e edição de pastas, habilidades, descrições e ícones;
- manutenção dos dois projetos, das experiências, das pastas e das habilidades originais;
- fallback local: se o Firebase ainda não estiver configurado ou estiver indisponível, o conteúdo padrão continua sendo exibido.

## Arquitetura

| Serviço | Responsabilidade |
| --- | --- |
| Vite | desenvolvimento local e build estático multipágina |
| Firebase Authentication | login por e-mail e senha em `/admin` |
| Cloud Firestore Standard | conteúdo público e lista de administradores |
| Cloudinary | capas, GIFs, favicon, coelhinho e ícones personalizados |
| Vercel ou Firebase Hosting | hospedagem dos arquivos gerados em `dist/` |

Todo o conteúdo público fica em um único documento, `portfolio/public`. Essa escolha reduz cada carregamento do portfólio a uma leitura, mantém uma publicação atômica e aproveita melhor a franquia gratuita. As imagens não são gravadas no documento: o Firestore armazena apenas suas URLs e metadados.

## Requisitos

- Node.js `20.19` ou superior, ou Node.js `22.12` ou superior;
- uma conta Firebase no plano Spark;
- uma conta Cloudinary no plano gratuito;
- opcionalmente, uma conta Vercel para publicação.

## Instalação local

No PowerShell:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Preencha o `.env` antes de testar a integração. O servidor local informa a URL pública, normalmente `http://localhost:5173`; o painel estará em `http://localhost:5173/admin`.

Comandos disponíveis:

```powershell
npm run dev      # servidor de desenvolvimento
npm run build    # gera dist/index.html e dist/admin/index.html
npm run preview  # confere localmente o conteúdo de dist/
```

## 1. Configurar o Firebase

### Criar o projeto e o app Web

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) e mantenha-o no plano gratuito **Spark**.
2. Crie um app do tipo Web nas configurações do projeto.
3. Copie os valores de `firebaseConfig` para as variáveis `VITE_FIREBASE_*` do `.env`.
4. Em **Firestore Database**, crie uma única base no modo nativo, edição **Standard**, escolhendo com cuidado a região. A região não pode ser alterada depois.

As chaves do app Web Firebase são identificadores públicos e aparecem no bundle do navegador. Não use essas variáveis para guardar uma conta de serviço, chave privada ou qualquer outro segredo. A autorização é garantida pelo Firebase Auth e pelas Firestore Security Rules.

### Ativar o login administrativo

1. Abra **Authentication → Sign-in method**.
2. Ative somente o provedor **E-mail/senha** necessário para este painel.
3. Abra **Authentication → Users → Add user** e crie manualmente o e-mail e a senha da administradora.
4. Copie o `UID` dessa usuária.
5. No Firestore, crie a coleção `admins`.
6. Dentro dela, crie um documento cujo ID seja exatamente o `UID` copiado.
7. Adicione ao documento o campo booleano `active` com valor `true`.

O painel não oferece cadastro público. Ainda assim, a ausência de um botão de cadastro não é uma barreira de segurança: somente um UID presente em `admins/{uid}` e com `active: true` pode gravar o conteúdo. Para revogar o acesso sem apagar a conta, altere `active` para `false`.

### Associar o projeto e publicar regras

Copie o modelo de projeto local e troque o ID:

```powershell
Copy-Item .firebaserc.example .firebaserc
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use seu-id-de-projeto-firebase
npx -y firebase-tools@latest deploy --only firestore
```

O `firebase.json` aponta para `firestore.rules` e `firestore.indexes.json`. Esses arquivos precisam existir antes do deploy. A política esperada é:

- leitura pública somente de `portfolio/public`;
- escrita em `portfolio/public` somente para usuários ativos em `admins/{uid}`;
- nenhuma criação de administradores pelo navegador;
- negação por padrão para qualquer outro caminho.

No primeiro acesso autorizado, o painel pode inicializar `portfolio/public` com o conteúdo padrão caso o documento ainda não exista. Os dois projetos e todas as demais informações atuais permanecem disponíveis para edição.

## 2. Configurar o Cloudinary

O nome correto do serviço usado para mídia é **Cloudinary**.

1. Crie uma conta gratuita e copie o **Cloud name** para `VITE_CLOUDINARY_CLOUD_NAME` ou `CLOUDINARY_CLOUD_NAME`.
2. Em **Settings → Upload → Upload presets**, crie um preset.
3. Defina o modo de assinatura como **Unsigned**.
4. Restrinja o preset a imagens, aos formatos realmente usados (`jpg`, `jpeg`, `png`, `webp`, `gif`, `ico` e, se necessário, `svg`) e a no máximo **10 MB**.
5. Defina uma pasta exclusiva, por exemplo `portfolio-jessica`, mantenha nomes únicos e desative sobrescrita quando essa opção estiver disponível.
6. Copie o nome do preset para `VITE_CLOUDINARY_UPLOAD_PRESET` ou `CLOUDINARY_UPLOAD_PRESET`.

O upload sai diretamente do navegador para o Cloudinary; o arquivo não atravessa a Vercel nem o Firebase. Isso permite GIFs maiores que o limite de payload de funções serverless, mas o plano gratuito do Cloudinary atualmente limita cada imagem a **10 MB**. `VITE_MAX_UPLOAD_MB=10` aplica a mesma validação na interface.

Um preset unsigned é necessariamente visível no código do navegador. Por isso, as restrições de formato, tamanho e pasta são obrigatórias. Monitore o uso da conta e troque/desative o preset se detectar uploads indevidos. Nunca adicione `CLOUDINARY_API_SECRET`, credenciais administrativas do Firebase ou outros segredos a uma variável iniciada por `VITE_`.

## 3. Variáveis de ambiente

O arquivo completo é [.env.example](.env.example):

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
VITE_MAX_UPLOAD_MB=10
DISCORD_WEBHOOK_URL=
DISCORD_CONTACT_USER_ID=1215077795651133479
```

Depois de alterar o `.env`, reinicie o servidor de desenvolvimento. O painel tenta primeiro as variáveis `VITE_CLOUDINARY_*` compiladas e, se necessário, consulta `/api/public-config` em runtime; os aliases `CLOUDINARY_CLOUD_NAME` e `CLOUDINARY_UPLOAD_PRESET` também são aceitos. Esses dois identificadores são públicos. `DISCORD_WEBHOOK_URL` é privada, só pode ser lida pela função `/api/contact` e deve ser configurada diretamente na Vercel. O webhook publica no canal associado e menciona `DISCORD_CONTACT_USER_ID`; webhooks do Discord não iniciam mensagens diretas.

## 4. Publicar na Vercel

1. Envie o projeto para um repositório Git.
2. Importe esse repositório na Vercel.
3. Cadastre todas as variáveis de `.env.example` em **Project Settings → Environment Variables** para os ambientes desejados.
4. A Vercel detectará o Vite. O projeto já fixa `npm run build` como comando e `dist` como diretório de saída.
5. Faça o deploy e teste a página inicial e `/admin` diretamente pela URL publicada.
6. Adicione o domínio final em **Firebase Authentication → Settings → Authorized domains**.

O [vercel.json](vercel.json) preserva a rota limpa `/admin` e adiciona cabeçalhos básicos de segurança. Cada alteração de uma variável `VITE_*` exige um novo deploy, pois o valor é incorporado no build.

O formulário de contato depende da função serverless `/api/contact` e, portanto, precisa da publicação pela Vercel (ou de uma função equivalente em outro provedor). O valor de `DISCORD_WEBHOOK_URL` permanece somente no ambiente do servidor.

## 5. Publicar no Firebase Hosting

Depois de configurar `.firebaserc` e `.env`:

```powershell
npm run build
npx -y firebase-tools@latest deploy --only hosting,firestore
```

O [firebase.json](firebase.json) publica `dist/`, mantém a URL limpa `/admin` e também referencia as regras e os índices. Para validar uma versão temporária antes de publicar:

```powershell
npx -y firebase-tools@latest hosting:channel:deploy preview
```

Vercel e Firebase Hosting são alternativas para servir o mesmo build; não é necessário usar os dois. Firebase Authentication e Firestore continuam funcionando quando o frontend está na Vercel.

## Uso do painel

1. Acesse diretamente `https://seu-dominio/admin`.
2. Entre com o usuário criado manualmente no Firebase Authentication.
3. Edite as seções e reordene os itens pelo painel.
4. Salve as alterações para atualizar `portfolio/public`.
5. Abra o site público para conferir a publicação.

Ao importar do GitHub, informe uma URL pública ou `usuario/repositorio`. Repositórios privados são recusados. A consulta usa a API pública do GitHub e, portanto, está sujeita aos limites anônimos do serviço.

## Limites e cuidados do plano gratuito

- O documento do Firestore tem limite máximo de 1 MiB. Para este portfólio, textos e URLs ficam muito abaixo disso; não armazene base64 ou arquivos no documento.
- A franquia gratuita do Firestore Standard inclui uma quantidade diária limitada de leituras e escritas. O documento único reduz o custo de carregamento para uma leitura por visita.
- O plano gratuito do Cloudinary limita imagens, inclusive GIFs, a 10 MB e também aplica limites de armazenamento, transformação e tráfego.
- O painel não exclui arquivos antigos do Cloudinary ao trocar uma imagem ou remover um projeto, pois exclusão segura exige credenciais de servidor. Faça a limpeza eventual pela **Media Library** para não acumular uploads órfãos.
- O favicon pode permanecer em cache no navegador depois de uma troca; uma atualização forçada normalmente exibe a nova versão.
- A rota `/admin` não aparece no site, mas isso é apenas discrição. A proteção real é a combinação de Firebase Authentication, allowlist `admins/{uid}` e Security Rules.
- Título, descrição e Open Graph são atualizados no navegador. Robôs que não executam JavaScript podem continuar lendo os metadados estáticos do `index.html`; prévias sociais totalmente dinâmicas exigiriam renderização no servidor.

## Conteúdo e arquivos locais

Os arquivos em `assets/` continuam sendo os padrões do portfólio, inclusive:

- `coelhinho.gif` e `coelhinho-estatico.png`;
- `lua-rosa.png`, usada pelo efeito interativo de halftone no hero;
- `project-cover-cafeteria.png` e `project-cover-sysdaisy.png`;
- `favicon.svg`;
- ícones locais das tecnologias.

O GIF-base foi fornecido para o projeto e teve apenas a paleta alterada. Para refazer a conversão, substitua `assets/coelhinho-base.gif` e execute:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/recolor_bunny.ps1
```

Os conteúdos e links dos projetos iniciais foram baseados nos repositórios públicos de [miwnyan](https://github.com/miwnyan), incluindo [SistemaCafeteria](https://github.com/miwnyan/SistemaCafeteria) e [SysDaisyOptimizer](https://github.com/miwnyan/SysDaisyOptimizer).
