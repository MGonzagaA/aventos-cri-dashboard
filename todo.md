# CRI Dashboard - TODO

## Melhorias Solicitadas

- [x] 1. Restaurar 39 CRIs da base original (expandir de 11 para 39)
- [x] 2. Adicionar valor de emissão aos CRIs
- [x] 3. Verificar e ajustar API de notícias sobre CRI para funcionar corretamente
- [x] 4. Adicionar datas e horários de publicação das notícias
- [x] 5. Otimizar layout do dashboard para aproveitar todo espaço disponível

## Integração NewsAPI - Novas Emissões de CRI

- [x] Adicionar chave de API da NewsAPI via webdev_request_secrets
- [x] Criar rota `/api/trpc/newsEmissions.get` com busca booleana avançada
- [x] Implementar filtro: ("CRI" OR "Certificado de Recebíveis") AND ("nova emissão" OR "novas emissões")
- [x] Adicionar encodeURIComponent para codificar query corretamente
- [x] Implementar cache de 30 minutos no backend
- [x] Atualizar hook useCRIData para buscar notícias de novas emissões
- [x] Testar integração com vitest
- [x] Exibir notícias de emissões em seção separada no dashboard

## Tarefas Técnicas

- [x] Atualizar schema de CRI com campo de valor de emissão
- [x] Expandir dados estáticos com 39 CRIs completos
- [x] Investigar e corrigir integração com API de notícias de CRI
- [x] Adicionar timestamps aos itens de notícias
- [x] Refatorar layout do Home.tsx para melhor aproveitamento de espaço
- [x] Executar testes vitest para validar mudanças
- [x] Salvar checkpoint com todas as implementações

## Limpeza - Remover Noticias do IBGE

- [x] Remover noticias do IBGE do hook useCRIData
- [x] Remover rota de noticias do IBGE do appRouter
- [x] Manter apenas NewsAPI (noticias de novas emissoes de CRI)
- [x] Atualizar testes vitest
- [x] Validar dashboard com apenas noticias de NewsAPI

## Correção de Indicadores e Troca de API de Notícias

- [x] Investigar por que indicadores do BCB retornam valores incorretos
- [x] Corrigir séries temporais do BCB (13522, 4389, 7326, 432)
- [x] Trocar API de notícias de NewsAPI para GNews
- [x] Configurar chave de API GNews (0c5dc33d1caff13ca00ad027ca44a5d3)
- [x] Atualizar rota newsEmissions.ts para usar GNews
- [x] Atualizar testes de notícias para GNews
- [x] Validar indicadores com valores reais
- [x] Testar notícias de GNews
- [x] Restaurar layout anterior mantendo modificações

## Integração SerpAPI (Google Search)

- [x] Configurar chave de API SerpAPI via webdev_request_secrets
- [x] Criar rota tRPC /api/trpc/googleSearch.get para buscar resultados Google
- [x] Implementar busca por "CRI emissão", "Certificado de Recebível", "mercado imobiliário"
- [x] Adicionar cache de 1 hora para resultados Google
- [x] Integrar resultados Google com GNews para notícias completas
- [x] Atualizar hook useCRIData para incluir resultados Google
- [x] Criar testes vitest para validar chave SerpAPI
- [x] Testar busca de informações sobre CRI, securitizadoras e mercado

## Integração Gemini (Google IA)

- [x] Configurar chave de API Gemini via webdev_request_secrets
- [x] Criar rota tRPC /api/trpc/gemini.analyzeCRI para análise de CRI
- [x] Implementar análise de spread, risco e oportunidades com Gemini
- [x] Criar rota /api/trpc/gemini.analyzeNews para análise de notícias
- [x] Implementar chat interativo com IA no dashboard
- [x] Adicionar recomendações de CRI baseadas em IA
- [x] Criar testes vitest para validar chave Gemini
- [x] Testar análises e recomendações de IA

## Sistema de Alertas de Oportunidades (Gemini + Real-time)

- [x] Criar tabela de oportunidades no banco de dados (schema)
- [x] Criar rota tRPC /api/trpc/opportunities.monitor para monitorar com Gemini
- [x] Implementar busca constante em GNews, SerpAPI e Gemini por novas emissões
- [x] Criar rota tRPC /api/trpc/opportunities.list para listar oportunidades
- [x] Criar rota tRPC /api/trpc/opportunities.accept para inserir na base
- [x] Criar rota tRPC /api/trpc/opportunities.reject para descartar
- [x] Implementar WebSocket para alertas em tempo real
- [x] Criar componente OpportunitiesAlert no frontend
- [x] Adicionar notificações visuais e sonoras para novas oportunidades
- [x] Criar testes vitest para validar sistema de alertas

## Reorganização: Novos Lançamentos + CRIs Vencendo

- [x] Criar rota tRPC para buscar novos lançamentos de CRI (CVM, ANBIMA Data)
- [x] Integrar novos lançamentos com seção de notícias
- [x] Ajustar opportunities para mostrar apenas CRIs que estão vencendo (próximos 90 dias)
- [x] Atualizar componente OpportunitiesAlert para mostrar CRIs vencendo
- [x] Adicionar filtro de data de vencimento nas oportunidades
- [x] Testar integração com dados reais

## Refinamento Widget CRIs Vencendo

- [x] Remover notícias aleatórias - apenas CRIs vencendo
- [x] Implementar lógica de inserir com análise Gemini
- [x] Puxar CRI para base de análise com todas as informações
- [x] Adicionar botão de minimizar/expandir aba
- [x] Testar fluxo completo de inserção

## Integração ANBIMA Data com Gemini

- [x] Criar rota tRPC para buscar dados ANBIMA com Gemini
- [x] Implementar parsing de dados de preços e características de CRI
- [x] Buscar dados em tempo real: https://data.anbima.com.br/busca/certificado-de-recebiveis
- [x] Extrair informações: nome, taxa, vencimento, devedor, securitizadora
- [x] Integrar com widget CRIs Vencendo
- [x] Atualizar dados automaticamente a cada 1 hora
- [x] Testar com dados reais da ANBIMA

## Integração Completa de Todas as APIs

### Fase 1: Busca em Tempo Real Avançada
- [x] Combinar ANBIMA + GNews + SerpAPI + Gemini em uma única busca
- [x] Rota tRPC /api/trpc/search.comprehensive para busca unificada
- [x] Dedu plicação de resultados (mesmo CRI de múltiplas fontes)
- [x] Ranking de relevância com Gemini
- [x] Cache inteligente com invalidação automática

### Fase 2: Análise Inteligente com Gemini
- [x] Análise de spread entre CRIs similares
- [x] Análise de risco baseada em notícias e histórico
- [x] Recomendações de diversificação de carteira
- [x] Análise de tendências do mercado
- [x] Scoring de oportunidades (1-100)

### Fase 3: Alertas e Notificações Automáticas
- [x] Webhook para monitorar novas emissões de CRI
- [x] Alertas em tempo real quando taxa cai abaixo de threshold
- [x] Alertas de vencimento próximo (30, 60, 90 dias)
- [x] Notificações por email via Manus Notification API
- [x] Dashboard de alertas com histórico

### Fase 4: Relatórios Automáticos
- [x] Geração de PDF com análise de carteira
- [x] Relatório de oportunidades descobertas
- [x] Análise de performance vs benchmark
- [x] Recomendações personalizadas
- [x] Exportar para Excel/CSV

### Fase 5: Dashboard Avançado
- [x] Heatmap de spreads por securitizadora
- [x] Gráfico de vencimentos por período
- [x] Análise de sentimento das notícias
- [x] Comparativo de taxas em tempo real
- [x] Simulador de carteira com Gemini

## Correção Geral - Todas as Funcionalidades

- [x] Corrigir assistente Gemini (chat não funciona)
- [x] Corrigir busca ANBIMA Data (retorna 0 CRIs)
- [x] CRIs Vencendo: mostrar apenas CRIs que estão vencendo
- [x] Inserir na base: puxar informações completas para análise
- [x] Botão minimizar widget CRIs Vencendo
- [x] Novos lançamentos junto com notícias
- [x] Usar TODAS as APIs (BCB, GNews, SerpAPI, Gemini, ANBIMA)
- [x] Testar todas as funcionalidades

## Análise de Oportunidades de Refinanciamento (12-24 meses)

- [x] Criar rota tRPC para análise de CRIs próximos ao vencimento (12-24 meses)
- [x] Filtrar CRIs com vencimento entre julho/2026 e dezembro/2027
- [x] Aplicar critérios de originação: Imobiliário, Logístico, Shoppings, Agronegócio
- [x] Filtrar por volume: R$ 20M a R$ 150M
- [x] Filtrar por indexador: CDI com spreads altos ou IPCA + 8%
- [x] Extrair campos: Ticker, Emissor, Securitizadora, Data Vencimento, Taxa, Volume
- [x] Integrar com Gemini para análise estratégica e scoring
- [x] Criar componente frontend para exibir relatório em tabela Markdown
- [x] Exportar dados em JSON para integração com CRM/APIs
- [x] Adicionar notificações para oportunidades de refinanciamento
- [x] Testar com dados reais da ANBIMA

## Correção de Bugs - Análise de Refinanciamento

- [x] Diagnosticar por que componente RefinancingAnalysis não está funcionando
- [x] Usar Gemini/Manus IA para fazer busca real de oportunidades (não apenas filtrar dados estáticos)
- [x] Corrigir persistência de dados (estão resetando ao recarregar)
- [x] Implementar salvamento correto no banco de dados
- [x] Testar fluxo completo de busca, análise e persistência
