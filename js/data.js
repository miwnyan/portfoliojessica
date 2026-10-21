/**
 * DADOS EDITÁVEIS
 * Adicione novos projetos ao array sem precisar modificar o HTML.
 * Para ativar o formulário de contato, preencha o e-mail real abaixo.
 */
window.portfolioData = {
  emailDestino: '',
  projetos: [
    {
      id: 'cafeteria',
      nome: 'SistemaCafeteria',
      resumo: 'Sistema de gerenciamento de cafeteria com cadastro de produtos, controle de estoque, vendas e relatórios.',
      descricao: 'Projeto de estudo desenvolvido em Python com banco de dados SQLite. Permite cadastrar e listar produtos, atualizar o estoque, registrar vendas com cupom fiscal, salvar comprovantes e consultar relatórios de vendas.',
      tecnologias: ['Python', 'SQLite', 'Gestão de estoque'],
      capa: 'assets/project-cover-cafeteria.png',
      repositorio: 'https://github.com/miwnyan/SistemaCafeteria'
    },
    {
      id: 'sysdaisy',
      nome: 'SysDaisyOptimizer',
      resumo: 'Aplicativo de otimização para Windows com rotinas de limpeza, ajustes de desempenho e recursos de manutenção.',
      descricao: 'Otimizador para Windows desenvolvido com PowerShell e WinForms. Reúne perfis de desempenho, limpeza de arquivos temporários, manutenção do sistema e recursos de backup e registro de operações.',
      tecnologias: ['PowerShell', 'WinForms', 'Windows'],
      capa: 'assets/project-cover-sysdaisy.png',
      repositorio: 'https://github.com/miwnyan/SysDaisyOptimizer'
    }
  ]
};
