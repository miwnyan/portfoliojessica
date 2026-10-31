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
| Namecheap Private Email | recebimento das mensagens do formulário por SMTP |
| GroqCloud | respostas do assistente virtual sobre o portfólio |
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

O painel aceita dois modos de configuração:

1. **Upload assinado (recomendado):** configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` na Vercel. Opcionalmente informe `CLOUDINARY_SIGNED_UPLOAD_PRESET`. O navegador pede uma assinatura temporária a `/api/cloudinary-signature`; a função valida o Firebase ID token e o registro ativo em `admins/{uid}` antes de assinar. O API Secret nunca é enviado ao navegador.
2. **Upload unsigned:** configure `VITE_CLOUDINARY_CLOUD_NAME` e `VITE_CLOUDINARY_UPLOAD_PRESET` (ou os aliases sem `VITE_`). Em **Settings → Upload → Upload presets**, o preset precisa estar explicitamente no modo **Unsigned**. Restrinja formatos, tamanho e pasta, pois o nome desse preset é público.

Também é aceito `CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME` no servidor. Nos dois modos, o arquivo segue diretamente do navegador para o Cloudinary; a função serverless só emite a assinatura curta, sem receber o arquivo. `VITE_MAX_UPLOAD_MB=10` aplica a validação de tamanho na interface.

Se o Cloudinary estiver preenchido na Vercel, mas o upload continuar indisponível, confira se as variáveis foram atribuídas ao ambiente correto (Production/Preview) e faça um novo deploy. Alterações de variáveis não modificam deployments já existentes. Nunca adicione `CLOUDINARY_API_SECRET`, credenciais administrativas do Firebase ou outros segredos a uma variável iniciada por `VITE_`.

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
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_SIGNED_UPLOAD_PRESET=
VITE_MAX_UPLOAD_MB=10
SMTP_HOST=mail.privateemail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=contato@jessicamontes.space
SMTP_PASSWORD=
CONTACT_EMAIL=contato@jessicamontes.space
SMTP_FROM_NAME=Portfólio da Jéssica
DISCORD_WEBHOOK_URL=
DISCORD_CONTACT_USER_ID=1215077795651133479
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
```

Depois de alterar o `.env`, reinicie o servidor de desenvolvimento. O painel tenta primeiro o upload assinado e usa o preset unsigned como fallback. O `Cloud name` e o nome do preset unsigned são identificadores públicos; `CLOUDINARY_API_SECRET` permanece exclusivamente no servidor.

O formulário usa o SMTP do Private Email como canal principal. `SMTP_PASSWORD` é a senha da caixa postal `contato@jessicamontes.space`, não a senha da conta Namecheap. Todas as variáveis `SMTP_*` são privadas, ficam somente no servidor e nunca devem receber o prefixo `VITE_`. O remetente autenticado permanece `SMTP_USER`; o e-mail informado pelo visitante é aplicado em `Reply-To`, permitindo responder diretamente.

`DISCORD_WEBHOOK_URL` também é privada e funciona como notificação adicional opcional. Se o SMTP estiver configurado, o formulário só confirma o envio depois que o servidor da Namecheap aceitar a mensagem; uma falha isolada do Discord não impede o recebimento por e-mail.

## Assistente virtual

O botão animado no canto inferior direito abre a Nyan, assistente do portfólio. Ela mantém conversas neste dispositivo, permite marcar conversas importantes, oferece respostas locais para perguntas frequentes e usa a Groq somente quando precisa interpretar uma dúvida mais específica. O mesmo painel também envia mensagens pela rota `/api/contact`, tanto pelo formulário quanto por um fluxo guiado na própria conversa. Nome, e-mail e mensagem desse fluxo não são enviados à Groq nem persistidos no histórico local. URLs e e-mails apresentados nas respostas são transformados em links clicáveis.

Para ativar as respostas por IA, crie uma chave no GroqCloud e configure no `.env`:

```dotenv
GROQ_API_KEY=sua-chave-privada
GROQ_MODEL=openai/gpt-oss-20b
```

Nunca use `VITE_GROQ_API_KEY`: qualquer variável `VITE_*` é exposta ao navegador. O modelo padrão é o GPT-OSS 20B em modo de raciocínio baixo, com resposta curta e estruturada. Perguntas simples, como apresentação, lista de projetos, habilidades, saudações e contato, são respondidas localmente e não consomem tokens.

A proteção contra prompt injection combina system prompt privado no servidor, escopo limitado ao portfólio, validação do contexto, detecção de padrões de manipulação, histórico e tamanho limitados, rate limit, saída JSON Schema estrita e validação final. Nenhuma defesa de LLM é absoluta; por isso a IA não possui ferramentas, não envia e-mails e não executa ações. O envio de contato só acontece pelo formulário explícito.

Sem `GROQ_API_KEY`, o widget e as respostas locais continuam disponíveis e dúvidas que dependeriam da IA orientam o visitante a entrar em contato. O servidor Vite executa `/api/chat` e `/api/contact` localmente, então basta reiniciar `npm run dev` depois de alterar o `.env`.

## 4. Publicar na Vercel

1. Envie o projeto para um repositório Git.
2. Importe esse repositório na Vercel.
3. Cadastre as variáveis necessárias de `.env.example` em **Project Settings → Environment Variables** para os ambientes desejados. Para mídia, prefira as credenciais privadas `CLOUDINARY_*` do modo assinado.
4. A Vercel detectará o Vite. O projeto já fixa `npm run build` como comando e `dist` como diretório de saída.
5. Faça o deploy e teste a página inicial e `/admin` diretamente pela URL publicada.
6. Adicione o domínio final em **Firebase Authentication → Settings → Authorized domains**.

O [vercel.json](vercel.json) preserva a rota limpa `/admin` e adiciona cabeçalhos básicos de segurança. Faça um novo deploy depois de alterar qualquer variável: valores `VITE_*` são incorporados no build e variáveis de funções também só passam a valer em um deployment novo.

O formulário de contato e o assistente dependem das funções serverless `/api/contact` e `/api/chat` e, portanto, precisam da publicação pela Vercel (ou de funções equivalentes em outro provedor). Cadastre `SMTP_PASSWORD` e `GROQ_API_KEY` como valores sensíveis e faça um novo deploy sempre que adicionar ou alterar qualquer variável. O envio SMTP é aguardado pela função antes da resposta de sucesso.

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
