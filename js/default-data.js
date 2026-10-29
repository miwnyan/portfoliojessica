const localIcon = fileName => `/assets/icons/${fileName}`;
const devicon = (name, variant = 'original') =>
  `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${name}/${name}-${variant}.svg`;
const iconify = name => `https://api.iconify.design/lucide/${name}.svg`;

const icon = (id, label, category, url, order, keywords = []) => ({
  id,
  label,
  category,
  url,
  keywords,
  order,
  visible: true
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

/**
 * Catálogo inicial do seletor de ícones do painel.
 *
 * Os ícones já presentes no projeto continuam locais. A seleção remota usa
 * Devicon (e alguns ícones genéricos do Lucide via Iconify), sem armazenar SVG
 * ou HTML fornecido pelo usuário.
 */
export const ICON_CATALOG = deepFreeze([
  icon('python', 'Python', 'languages', localIcon('python.svg'), 10, ['py']),
  icon('javascript', 'JavaScript', 'languages', localIcon('javascript.svg'), 20, ['js', 'ecmascript']),
  icon('typescript', 'TypeScript', 'languages', devicon('typescript'), 30, ['ts']),
  icon('java', 'Java', 'languages', devicon('java'), 40),
  icon('csharp', 'C#', 'languages', devicon('csharp'), 50, ['c sharp', '.net']),
  icon('cplusplus', 'C++', 'languages', devicon('cplusplus'), 60, ['cpp']),
  icon('c', 'C', 'languages', devicon('c'), 70),
  icon('go', 'Go', 'languages', devicon('go'), 80, ['golang']),
  icon('rust', 'Rust', 'languages', devicon('rust'), 90),
  icon('php', 'PHP', 'languages', devicon('php'), 100),
  icon('ruby', 'Ruby', 'languages', devicon('ruby'), 110),
  icon('kotlin', 'Kotlin', 'languages', devicon('kotlin'), 120),
  icon('swift', 'Swift', 'languages', devicon('swift'), 130),
  icon('dart', 'Dart', 'languages', devicon('dart'), 140),
  icon('r', 'R', 'languages', devicon('r'), 150),
  icon('scala', 'Scala', 'languages', devicon('scala'), 160),
  icon('lua', 'Lua', 'languages', devicon('lua'), 170),
  icon('bash', 'Bash', 'languages', devicon('bash'), 180, ['shell', 'terminal']),
  icon('powershell', 'PowerShell', 'languages', localIcon('powershell.svg'), 190, ['shell', 'windows']),

  icon('html5', 'HTML5', 'web-frameworks', localIcon('html5.svg'), 210, ['html', 'web']),
  icon('css3', 'CSS3', 'web-frameworks', localIcon('css.svg'), 220, ['css', 'web']),
  icon('react', 'React', 'web-frameworks', devicon('react'), 230, ['reactjs']),
  icon('nextjs', 'Next.js', 'web-frameworks', devicon('nextjs'), 240, ['next', 'react']),
  icon('vuejs', 'Vue.js', 'web-frameworks', devicon('vuejs'), 250, ['vue']),
  icon('angular', 'Angular', 'web-frameworks', devicon('angularjs'), 260, ['angularjs']),
  icon('svelte', 'Svelte', 'web-frameworks', devicon('svelte'), 270),
  icon('nodejs', 'Node.js', 'web-frameworks', devicon('nodejs'), 280, ['node']),
  icon('express', 'Express', 'web-frameworks', devicon('express'), 290, ['expressjs']),
  icon('django', 'Django', 'web-frameworks', devicon('django'), 300),
  icon('flask', 'Flask', 'web-frameworks', devicon('flask'), 310),
  icon('fastapi', 'FastAPI', 'web-frameworks', devicon('fastapi'), 320),
  icon('spring', 'Spring', 'web-frameworks', devicon('spring'), 330, ['spring boot']),
  icon('dotnet', '.NET', 'web-frameworks', devicon('dot-net', 'original-wordmark'), 340, ['asp.net']),
  icon('laravel', 'Laravel', 'web-frameworks', devicon('laravel'), 350),
  icon('flutter', 'Flutter', 'web-frameworks', devicon('flutter'), 360),
  icon('tailwindcss', 'Tailwind CSS', 'web-frameworks', devicon('tailwindcss'), 370, ['tailwind']),
  icon('bootstrap', 'Bootstrap', 'web-frameworks', devicon('bootstrap'), 380),

  icon('sqlite', 'SQLite', 'databases', localIcon('sqlite.svg'), 410, ['sql']),
  icon('postgresql', 'PostgreSQL', 'databases', devicon('postgresql'), 420, ['postgres', 'sql']),
  icon('mysql', 'MySQL', 'databases', devicon('mysql'), 430, ['sql']),
  icon('mariadb', 'MariaDB', 'databases', devicon('mariadb'), 440, ['sql']),
  icon('mongodb', 'MongoDB', 'databases', devicon('mongodb'), 450, ['nosql']),
  icon('redis', 'Redis', 'databases', devicon('redis'), 460, ['cache']),
  icon('firebase', 'Firebase', 'databases', devicon('firebase'), 470, ['firestore', 'google']),
  icon('supabase', 'Supabase', 'databases', devicon('supabase'), 480, ['postgres']),
  icon('database', 'Banco de dados', 'databases', localIcon('database.svg'), 490, ['dados', 'sql', 'storage']),

  icon('azure', 'Microsoft Azure', 'cloud-devops', localIcon('azure.svg'), 510, ['cloud', 'nuvem']),
  icon('amazonwebservices', 'Amazon Web Services', 'cloud-devops', devicon('amazonwebservices', 'plain-wordmark'), 520, ['aws', 'cloud']),
  icon('googlecloud', 'Google Cloud', 'cloud-devops', devicon('googlecloud'), 530, ['gcp', 'cloud']),
  icon('docker', 'Docker', 'cloud-devops', devicon('docker'), 540, ['container']),
  icon('kubernetes', 'Kubernetes', 'cloud-devops', devicon('kubernetes'), 550, ['k8s', 'container']),
  icon('terraform', 'Terraform', 'cloud-devops', devicon('terraform'), 560, ['iac']),
  icon('cloudflare', 'Cloudflare', 'cloud-devops', devicon('cloudflare'), 570, ['workers', 'cdn']),
  icon('vercel', 'Vercel', 'cloud-devops', devicon('vercel'), 580, ['deploy', 'hosting']),
  icon('nginx', 'NGINX', 'cloud-devops', devicon('nginx'), 590, ['server', 'proxy']),

  icon('cisco', 'Cisco', 'security-networks', localIcon('cisco.svg'), 610, ['network', 'rede']),
  icon('network', 'Redes', 'security-networks', localIcon('network.svg'), 620, ['networking', 'infraestrutura']),
  icon('security', 'Cibersegurança', 'security-networks', localIcon('security.svg'), 630, ['security', 'shield']),
  icon('linux', 'Linux', 'security-networks', devicon('linux'), 640, ['operating system']),
  icon('kali', 'Kali Linux', 'security-networks', devicon('kalilinux'), 650, ['pentest', 'security']),
  icon('windows', 'Windows', 'security-networks', localIcon('microsoft.svg'), 660, ['microsoft', 'operating system']),

  icon('github', 'GitHub', 'tools', localIcon('github.svg'), 710, ['git', 'repository']),
  icon('git', 'Git', 'tools', devicon('git'), 720, ['version control']),
  icon('vscode', 'Visual Studio Code', 'tools', devicon('vscode'), 730, ['editor', 'ide']),
  icon('visualstudio', 'Visual Studio', 'tools', devicon('visualstudio'), 740, ['ide', 'microsoft']),
  icon('postman', 'Postman', 'tools', devicon('postman'), 750, ['api']),
  icon('openapi', 'OpenAPI / REST', 'tools', localIcon('openapi.svg'), 760, ['api', 'swagger']),
  icon('figma', 'Figma', 'tools', devicon('figma'), 770, ['design', 'ui']),
  icon('npm', 'npm', 'tools', devicon('npm'), 780, ['package manager']),
  icon('pnpm', 'pnpm', 'tools', devicon('pnpm'), 790, ['package manager']),
  icon('yarn', 'Yarn', 'tools', devicon('yarn'), 800, ['package manager']),

  icon('powerbi', 'Power BI', 'data-ai', localIcon('powerbi.svg'), 810, ['dados', 'dashboard']),
  icon('pandas', 'Pandas', 'data-ai', devicon('pandas'), 820, ['python', 'data']),
  icon('numpy', 'NumPy', 'data-ai', devicon('numpy'), 830, ['python', 'data']),
  icon('jupyter', 'Jupyter', 'data-ai', devicon('jupyter'), 840, ['notebook', 'python']),
  icon('tensorflow', 'TensorFlow', 'data-ai', devicon('tensorflow'), 850, ['machine learning', 'ai']),
  icon('pytorch', 'PyTorch', 'data-ai', devicon('pytorch'), 860, ['machine learning', 'ai']),

  icon('code', 'Código', 'generic', localIcon('code.svg'), 910, ['programação', 'development']),
  icon('microsoft', 'Microsoft', 'generic', localIcon('microsoft.svg'), 920),
  icon('cloud', 'Nuvem', 'generic', iconify('cloud'), 930, ['cloud']),
  icon('terminal', 'Terminal', 'generic', iconify('terminal'), 940, ['console', 'shell']),
  icon('globe', 'Web', 'generic', iconify('globe-2'), 950, ['internet', 'site']),
  icon('folder', 'Pasta', 'generic', iconify('folder'), 960, ['diretório']),
  icon('wrench', 'Ferramenta', 'generic', iconify('wrench'), 970, ['tool']),
  icon('award', 'Certificação', 'generic', iconify('award'), 980, ['certificate']),
  icon('github-contact', 'GitHub (contato)', 'contacts', localIcon('github.svg'), 1010, ['social']),
  icon('linkedin', 'LinkedIn', 'contacts', devicon('linkedin'), 1020, ['social']),
  icon('mail', 'Mensagem / e-mail', 'contacts', iconify('mail'), 1030, ['contact', 'email'])
]);

export const DEFAULT_PORTFOLIO = deepFreeze({
  schemaVersion: 3,
  settings: {
    meta: {
      title: 'Jéssica | Portfólio',
      description: 'Portfólio de Jéssica. Desenvolvimento de sistemas, redes de computadores e segurança cibernética.',
      ogTitle: 'Jéssica | Portfólio',
      ogDescription: 'Projetos, habilidades e experiência profissional.',
      faviconUrl: '/assets/favicon.svg',
      themeColor: '#09080a'
    },
    navigation: {
      home: 'Início',
      about: 'Sobre',
      projects: 'Projetos',
      contact: 'Contato'
    },
    hero: {
      eyebrow: 'Portfólio pessoal',
      intro: 'Olá, eu sou a ',
      name: 'Jéssica',
      subtitle: 'Desenvolvimento de Sistemas',
      description: 'Técnica em Redes de Computadores e estudante de Análise e Desenvolvimento de Sistemas, com formação em Segurança Cibernética.',
      primaryLabel: 'Ver projetos',
      secondaryLabel: 'Entrar em contato'
    },
    about: {
      title: 'Sobre mim',
      paragraphs: [
        'Sou técnica em Redes de Computadores pela Firjan SENAI Maracanã, com formação complementar em segurança cibernética e experiência em projetos práticos.',
        'Atualmente curso Análise e Desenvolvimento de Sistemas na PUCPR e desenvolvo projetos voltados à programação, automação e tecnologia.',
        'Participei da preparação técnica da WorldSkills na modalidade Segurança Cibernética.'
      ],
      bunnyAnimatedUrl: '/assets/coelhinho.gif',
      bunnyStaticUrl: '/assets/coelhinho-estatico.png',
      bunnyAlt: 'Coelhinho rosa em pixel art'
    },
    sections: {
      skillsTitle: 'Habilidades & Tecnologias',
      skillsIntro: 'Fique a vontade para abrir as pastas e explorar as tecnologias que domino.',
      experienceTitle: 'Experiência',
      projectsTitle: 'Meus Projetos',
      projectsIntro: 'Projetos publicados no GitHub.',
      contactTitle: 'Entre em contato'
    },
    contact: {
      formTitle: 'Envie uma mensagem',
      nameLabel: 'Nome',
      emailLabel: 'E-mail',
      messageLabel: 'Mensagem',
      submitLabel: 'Enviar mensagem',
      destinationEmail: '',
      infoTitle: 'Sobre meu trabalho',
      infoText: 'Desenvolvimento de sistemas, segurança cibernética, redes de computadores e automação.',
      services: ['Desenvolvimento de projetos', 'Segurança & redes', 'Automação'],
      socialTitle: 'Minhas redes'
    },
    footer: {
      name: 'Jéssica Montes Santos',
      tagline: 'Desenvolvimento de Sistemas · Redes · Cibersegurança',
      backLabel: 'Voltar ao início',
      copyrightName: 'Jéssica',
      credit: 'Desenvolvido por Jéssica Montes Santos.'
    },
    ui: {
      skipToContentLabel: 'Ir para o conteúdo',
      menuOpenLabel: 'Abrir menu',
      menuCloseLabel: 'Fechar menu',
      folderOpenLabel: 'Abrir pasta',
      folderCloseLabel: 'Fechar pasta',
      folderMoreLabel: 'Ver mais',
      folderLessLabel: 'Ver menos',
      experienceExpandLabel: 'Ver mais experiências',
      experienceCollapseLabel: 'Recolher experiências',
      experienceCollapsedCount: 2,
      projectDetailsLabel: 'Ver detalhes',
      projectRepositoryLabel: 'Ver no GitHub',
      projectRepositoryTitle: 'Abrir repositório',
      projectHomepageLabel: 'Visitar projeto',
      projectHomepageTitle: 'Abrir projeto publicado',
      contactMissingEmail: 'Para ativar o envio, configure o e-mail de destino no painel administrativo.',
      contactOpeningEmail: 'Abrindo seu aplicativo de e-mail para concluir o envio.',
      skillDialogCloseLabel: 'Fechar detalhes',
      projectDialogCloseLabel: 'Fechar detalhes'
    },
    theme: {
      bg: '#09080a',
      bgAlt: '#0c0a0d',
      panel: '#171418',
      panelDark: '#100e12',
      border: '#342635',
      borderSoft: '#261e29',
      accent: '#efadd0',
      accentLight: '#f9cee1',
      accentDeep: '#bc7fa3',
      text: '#f7f5f7',
      muted: '#a9a3aa',
      radius: '11px'
    }
  },
  projects: [
    {
      id: 'lastro',
      order: 0,
      visible: true,
      name: 'Lastro',
      summary: 'Controle financeiro pessoal local com lançamentos, resumo e exportação CSV.',
      description: 'Aplicação para registrar entradas e saídas, acompanhar saldo, receitas, despesas e participação por categoria. Inclui filtros mensais, edição de lançamentos e exportação CSV, com valores armazenados em centavos para evitar erros de ponto flutuante.',
      technologies: ['JavaScript', 'LocalStorage', 'CSV'],
      coverUrl: '/assets/projects/lastro-preview.png',
      coverAlt: 'Preview do painel financeiro Lastro',
      repositoryUrl: 'https://github.com/miwnyan/lastro-financas',
      homepageUrl: 'https://lastrofinancas.vercel.app',
      source: 'github',
      github: { owner: 'miwnyan', repo: 'lastro-financas' }
    },
    {
      id: 'nexo',
      order: 1,
      visible: true,
      name: 'Nexo',
      summary: 'Conversor de moedas e unidades com histórico local e cotações de referência.',
      description: 'Conversor de moedas, comprimento, massa e temperatura. As conversões de unidades funcionam offline; o câmbio consulta a API Frankfurter, informa a data da taxa e mantém um histórico local das últimas conversões.',
      technologies: ['JavaScript', 'API REST', 'LocalStorage'],
      coverUrl: '/assets/projects/nexo-preview.png',
      coverAlt: 'Preview do conversor Nexo',
      repositoryUrl: 'https://github.com/miwnyan/nexo-conversor',
      homepageUrl: 'https://nexoconversor-pi.vercel.app',
      source: 'github',
      github: { owner: 'miwnyan', repo: 'nexo-conversor' }
    },
    {
      id: 'cirro',
      order: 2,
      visible: true,
      name: 'Cirro',
      summary: 'Observatório meteorológico com condições atuais e previsão para seis dias.',
      description: 'Boletim meteorológico com busca de cidades, geolocalização opcional, condições atuais e previsão de seis dias. Integra Open-Meteo, trata consultas concorrentes com AbortController e adapta os objetos 3D à condição do tempo.',
      technologies: ['JavaScript', 'Open-Meteo', 'Geolocation'],
      coverUrl: '/assets/projects/cirro-preview.png',
      coverAlt: 'Preview do observatório meteorológico Cirro',
      repositoryUrl: 'https://github.com/miwnyan/cirro-clima',
      homepageUrl: 'https://cirroclima.vercel.app',
      source: 'github',
      github: { owner: 'miwnyan', repo: 'cirro-clima' }
    },
    {
      id: 'prumo',
      order: 3,
      visible: true,
      name: 'Prumo',
      summary: 'Gerenciador de tarefas local com prioridades, filtros, pesquisa e progresso.',
      description: 'Gerenciador de tarefas acessível para criar, editar, concluir e excluir itens. Oferece prioridades, notas, datas-limite, filtros, pesquisa, ordenação, atalhos de teclado e persistência local no navegador.',
      technologies: ['JavaScript', 'Acessibilidade', 'LocalStorage'],
      coverUrl: '/assets/projects/prumo-preview.png',
      coverAlt: 'Preview do gerenciador de tarefas Prumo',
      repositoryUrl: 'https://github.com/miwnyan/prumo-tarefas',
      homepageUrl: 'https://prumo-tarefas-wine.vercel.app',
      source: 'github',
      github: { owner: 'miwnyan', repo: 'prumo-tarefas' }
    },
    {
      id: 'cafeteria',
      order: 4,
      visible: true,
      name: 'SistemaCafeteria',
      summary: 'Sistema de gerenciamento de cafeteria com estoque, vendas e relatórios.',
      description: 'Projeto desenvolvido em Python com banco de dados SQLite. Permite cadastrar produtos, atualizar o estoque, registrar vendas com cupom fiscal, salvar comprovantes e consultar relatórios.',
      technologies: ['Python', 'SQLite', 'Gestão de estoque'],
      coverUrl: '/assets/project-cover-cafeteria.png',
      coverAlt: 'Preview do sistema de gerenciamento de cafeteria',
      repositoryUrl: 'https://github.com/miwnyan/SistemaCafeteria',
      source: 'github',
      github: { owner: 'miwnyan', repo: 'SistemaCafeteria' }
    },
    {
      id: 'sysdaisy',
      order: 5,
      visible: true,
      name: 'SysDaisyOptimizer',
      summary: 'Aplicativo de otimização e manutenção para ambientes Windows.',
      description: 'Otimizador para Windows desenvolvido com PowerShell e WinForms. Reúne perfis de desempenho, limpeza de arquivos temporários, manutenção do sistema, backup e registro de operações.',
      technologies: ['PowerShell', 'WinForms', 'Windows'],
      coverUrl: '/assets/project-cover-sysdaisy.png',
      coverAlt: 'Preview do aplicativo SysDaisyOptimizer',
      repositoryUrl: 'https://github.com/miwnyan/SysDaisyOptimizer',
      source: 'github',
      github: { owner: 'miwnyan', repo: 'SysDaisyOptimizer' }
    }
  ],
  experiences: [
    {
      id: 'technical-networks',
      order: 0,
      visible: true,
      period: '2025',
      startDate: '2025',
      endDate: '2025-11',
      title: 'Formação Técnica em Redes de Computadores',
      institution: 'Firjan SENAI Maracanã',
      description: 'Formação técnica concluída em novembro de 2025, com carga horária de 1.000 horas.'
    },
    {
      id: 'worldskills-cybersecurity',
      order: 1,
      visible: true,
      period: '2024–25',
      startDate: '2024',
      endDate: '2025',
      title: 'WorldSkills — Segurança Cibernética',
      institution: 'Firjan SENAI Maracanã',
      description: 'Preparação técnica com foco em segurança cibernética, redes e resolução de problemas.'
    }
  ],
  folders: [
    {
      id: 'programming-web',
      order: 0,
      visible: true,
      name: 'Programação & Web',
      color: '#d991ba',
      colorDeep: '#8f5578',
      openByDefault: true
    },
    {
      id: 'data-automation',
      order: 1,
      visible: true,
      name: 'Dados & Automação',
      color: '#c982ad',
      colorDeep: '#794762',
      openByDefault: true
    },
    {
      id: 'cloud-security',
      order: 2,
      visible: true,
      name: 'Cloud & Segurança',
      color: '#b8759c',
      colorDeep: '#684052',
      openByDefault: true
    }
  ],
  skills: [
    {
      id: 'python', folderId: 'programming-web', order: 0, visible: true,
      name: 'Python', title: 'Python', badge: '', status: 'Tecnologia em prática', iconId: 'python', iconUrl: '/assets/icons/python.svg',
      description: 'Linguagem usada para construir soluções com regras de negócio, automação e persistência de dados.',
      details: ['Estruturas de dados, funções e organização de código.', 'Integração com bancos de dados relacionais.', 'Base para estudos de orientação a objetos e Machine Learning.']
    },
    {
      id: 'javascript', folderId: 'programming-web', order: 1, visible: true,
      name: 'JavaScript', title: 'JavaScript', badge: '', status: 'Conhecimento atual', iconId: 'javascript', iconUrl: '/assets/icons/javascript.svg',
      description: 'Linguagem utilizada para criar comportamento, interação e experiências dinâmicas na web.',
      details: ['Manipulação do DOM e eventos.', 'Interações acessíveis em interfaces web.', 'Integração com HTML, CSS e APIs.']
    },
    {
      id: 'html5', folderId: 'programming-web', order: 2, visible: true,
      name: 'HTML5', title: 'HTML5', badge: 'em aprendizado', status: 'Em aprendizado', iconId: 'html5', iconUrl: '/assets/icons/html5.svg',
      description: 'Estruturação semântica de páginas e aplicações web com atenção à acessibilidade.',
      details: ['Semântica e organização de conteúdo.', 'Formulários e elementos interativos.', 'Boas práticas de acessibilidade.']
    },
    {
      id: 'css3', folderId: 'programming-web', order: 3, visible: true,
      name: 'CSS3', title: 'CSS3', badge: 'em aprendizado', status: 'Em aprendizado', iconId: 'css3', iconUrl: '/assets/icons/css.svg',
      description: 'Estilização responsiva de interfaces, componentes e animações para a web.',
      details: ['Layouts com Grid e Flexbox.', 'Responsividade para desktop e mobile.', 'Transições, animações e estados de interação.']
    },
    {
      id: 'apis', folderId: 'programming-web', order: 4, visible: true,
      name: 'APIs REST', title: 'APIs REST', badge: 'em aprendizado', status: 'Em aprendizado', iconId: 'openapi', iconUrl: '/assets/icons/openapi.svg',
      description: 'Comunicação entre sistemas por endpoints, métodos HTTP e dados estruturados.',
      details: ['Conceitos de recursos e rotas.', 'Requisições e respostas em JSON.', 'Integração entre frontend e backend.']
    },
    {
      id: 'github', folderId: 'programming-web', order: 5, visible: true,
      name: 'GitHub', title: 'GitHub', badge: '', status: 'Ferramenta de desenvolvimento', iconId: 'github', iconUrl: '/assets/icons/github.svg',
      description: 'Plataforma usada para versionar, documentar e colaborar no desenvolvimento de software.',
      details: ['Organização de repositórios.', 'Histórico de alterações com Git.', 'Uso de branches, commits e documentação.']
    },
    {
      id: 'sqlite', folderId: 'data-automation', order: 0, visible: true,
      name: 'SQLite', title: 'SQLite', badge: '', status: 'Tecnologia em prática', iconId: 'sqlite', iconUrl: '/assets/icons/sqlite.svg',
      description: 'Banco de dados relacional leve para aplicações locais e soluções que precisam de persistência simples.',
      details: ['Criação e organização de bancos relacionais.', 'Cadastro, consulta e atualização de dados.', 'Persistência e integridade de informações.']
    },
    {
      id: 'powershell', folderId: 'data-automation', order: 1, visible: true,
      name: 'PowerShell', title: 'PowerShell', badge: '', status: 'Tecnologia em prática', iconId: 'powershell', iconUrl: '/assets/icons/powershell.svg',
      description: 'Linguagem de automação e administração utilizada em ambientes Windows.',
      details: ['Automação de tarefas administrativas no Windows.', 'Rotinas de limpeza e manutenção.', 'Interface gráfica com Windows Forms.']
    },
    {
      id: 'sql', folderId: 'data-automation', order: 2, visible: true,
      name: 'SQL', title: 'SQL', badge: 'em aprendizado', status: 'Em aprendizado', iconId: 'database', iconUrl: '/assets/icons/database.svg',
      description: 'Linguagem para modelar, consultar e transformar dados em bancos relacionais.',
      details: ['Consultas, filtros e ordenação.', 'Relacionamentos entre tabelas.', 'Operações de inserção, atualização e exclusão.']
    },
    {
      id: 'machine-learning', folderId: 'data-automation', order: 3, visible: true,
      name: 'Machine Learning', title: 'Machine Learning com Python', badge: 'com Python', status: 'Em aprendizado', iconId: 'python', iconUrl: '/assets/icons/python.svg',
      description: 'Estudo de técnicas que permitem analisar dados e construir modelos computacionais com Python.',
      details: ['Preparação e exploração de dados.', 'Fundamentos de modelos preditivos.', 'Uso do ecossistema Python para análise.']
    },
    {
      id: 'power-bi', folderId: 'data-automation', order: 4, visible: true,
      name: 'Power BI', title: 'Power BI', badge: 'em aprendizado', status: 'Em aprendizado', iconId: 'powerbi', iconUrl: '/assets/icons/powerbi.svg',
      description: 'Ferramenta para transformar dados em relatórios visuais e apoiar análises.',
      details: ['Preparação e organização de dados.', 'Criação de indicadores e visuais.', 'Construção de painéis interativos.']
    },
    {
      id: 'poo', folderId: 'data-automation', order: 5, visible: true,
      name: 'POO', title: 'Programação Orientada a Objetos', badge: 'em aprendizado', status: 'Em aprendizado', iconId: 'code', iconUrl: '/assets/icons/code.svg',
      description: 'Paradigma para estruturar sistemas por meio de objetos, responsabilidades e relações.',
      details: ['Classes, objetos e métodos.', 'Encapsulamento e reutilização.', 'Organização modular e manutenção do código.']
    },
    {
      id: 'cisco-ccst', folderId: 'cloud-security', order: 0, visible: true,
      name: 'Cisco CCST', title: 'Cisco Certified Support Technician (CCST) Cybersecurity', badge: '', status: 'Certificação internacional', iconId: 'cisco', iconUrl: '/assets/icons/cisco.svg',
      description: 'Certificação Cisco voltada aos fundamentos técnicos e operacionais de cibersegurança.',
      details: ['Emissora: Cisco.', 'Princípios de segurança, ameaças e vulnerabilidades.', 'Controles de acesso, proteção de redes e resposta a incidentes.']
    },
    {
      id: 'azure', folderId: 'cloud-security', order: 1, visible: true,
      name: 'Microsoft Azure', title: 'Microsoft Azure Fundamentals', badge: '', status: 'Certificação internacional · AZ-900', iconId: 'azure', iconUrl: '/assets/icons/azure.svg',
      certificateUrl: '/assets/certificates/azure-fundamentals.png',
      description: 'Certificação Microsoft sobre conceitos de nuvem e os principais serviços da plataforma Azure.',
      details: ['Emissora: Microsoft.', 'Conceitos e modelos de computação em nuvem.', 'Serviços do Azure, segurança, governança e custos.']
    },
    {
      id: 'microsoft-security', folderId: 'cloud-security', order: 2, visible: true,
      name: 'Microsoft Security', title: 'Microsoft Security, Compliance, and Identity Fundamentals', badge: '', status: 'Certificação internacional · SC-900', iconId: 'microsoft', iconUrl: '/assets/icons/microsoft.svg',
      certificateUrl: '/assets/certificates/security-compliance-identity.png',
      description: 'Certificação Microsoft sobre fundamentos de segurança, conformidade e identidade.',
      details: ['Emissora: Microsoft.', 'Conceitos de identidade e acesso.', 'Soluções Microsoft de segurança, conformidade e proteção.']
    },
    {
      id: 'networks', folderId: 'cloud-security', order: 3, visible: true,
      name: 'Redes', title: 'Redes de Computadores', badge: '', status: 'Formação técnica', iconId: 'network', iconUrl: '/assets/icons/network.svg',
      certificateUrl: '/assets/certificates/redes-computadores.png',
      description: 'Base técnica para configurar, manter e diagnosticar a comunicação entre dispositivos e serviços.',
      details: ['Formação técnica pela Firjan SENAI Maracanã.', 'Fundamentos de infraestrutura e protocolos.', 'Diagnóstico e resolução de problemas de conectividade.']
    },
    {
      id: 'cybersecurity', folderId: 'cloud-security', order: 4, visible: true,
      name: 'Cibersegurança', title: 'Cibersegurança', badge: '', status: 'Formação complementar', iconId: 'security', iconUrl: '/assets/icons/security.svg',
      certificateUrl: '/assets/certificates/seguranca-cibernetica.png',
      description: 'Conhecimentos voltados à proteção de sistemas, redes e informações contra riscos digitais.',
      details: ['Preparação técnica para a WorldSkills.', 'Análise de ameaças e vulnerabilidades.', 'Práticas defensivas e resolução de incidentes.']
    },
    {
      id: 'windows', folderId: 'cloud-security', order: 5, visible: true,
      name: 'Windows', title: 'Windows', badge: '', status: 'Ambiente de aplicação', iconId: 'windows', iconUrl: '/assets/icons/microsoft.svg',
      description: 'Ambiente utilizado em estudos de redes, administração e automação de sistemas.',
      details: ['Administração e manutenção do sistema.', 'Automação com PowerShell.', 'Gerenciamento de serviços e recursos do Windows.']
    }
  ],
  contacts: [
    {
      id: 'github',
      order: 0,
      visible: true,
      type: 'external',
      label: 'GitHub',
      url: 'https://github.com/miwnyan',
      iconId: 'github-contact',
      iconUrl: '',
      ariaLabel: 'GitHub de Jéssica',
      title: 'GitHub'
    },
    {
      id: 'linkedin',
      order: 1,
      visible: true,
      type: 'external',
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/in/jessicamontessantos',
      iconId: 'linkedin',
      iconUrl: '',
      ariaLabel: 'LinkedIn de Jéssica',
      title: 'LinkedIn'
    },
    {
      id: 'message',
      order: 2,
      visible: true,
      type: 'anchor',
      label: 'Mensagem',
      url: '#contact-form',
      iconId: 'mail',
      iconUrl: '',
      ariaLabel: 'Enviar mensagem',
      title: 'Mensagem'
    }
  ]
});

export function cloneDefaultPortfolio() {
  if (typeof structuredClone === 'function') return structuredClone(DEFAULT_PORTFOLIO);
  return JSON.parse(JSON.stringify(DEFAULT_PORTFOLIO));
}
