# Avaliação técnica — Oracle MCP para o Urbico

Data da avaliação: 2026-10-28

## Decisão

Usar o repositório oficial https://github.com/oracle/mcp como referência para administrar a infraestrutura OCI do Urbico é promissor. Não incorporar o servidor MCP ao runtime do aplicativo nem adicioná-lo às dependências do Expo/Express.

O repositório Oracle descreve implementações de referência MCP, não uma solução automaticamente pronta para produção. A documentação recomenda `oracle.oci-cloud-mcp-server` para operações gerais OCI e `oracle.oci-api-mcp-server` quando for necessário usar a OCI CLI.

## Onde pode ajudar

- Descobrir e inspecionar recursos OCI e apoiar o diagnóstico da infraestrutura.
- Automatizar tarefas administrativas repetitivas, com permissões OCI explícitas.
- Dar aos agentes compatíveis uma interface padronizada para operações de nuvem.
- Ajudar a verificar o estado dos recursos antes de migrar o backend para a Oracle.

## Onde não resolve por si só

- Não corrige o fluxo de autenticação Supabase Google do Urbico.
- Não substitui a API Express/tRPC, o banco MySQL/Drizzle ou o Supabase Auth.
- Não fornece automaticamente geocodificação Pelias, roteamento pedestre Valhalla ou dados de ônibus.
- Não torna a infraestrutura Oracle gratuita por si só. Custos dependem dos recursos provisionados e da elegibilidade da conta.
- Não garante segurança operacional: credenciais, políticas IAM, rede e aprovação de operações destrutivas precisam ser configuradas.

## Plano de adoção com risco baixo

1. **Inventário somente leitura:** confirmar tenancy, região, autenticação OCI, recursos existentes, estado e limites de acesso.
2. **Validar acesso:** instalar/configurar o servidor MCP em ambiente administrativo controlado, sem expor credenciais ao repositório nem ao app.
3. **Plano de hospedagem:** verificar disponibilidade e elegibilidade de recursos OCI antes de provisionar qualquer coisa.
4. **Preparar o Urbico:** planejar backend, banco, variáveis de ambiente, HTTPS, logs, health/readiness checks e recuperação.
5. **Validar antes de mutações:** qualquer criação, exclusão, alteração de rede, política IAM ou recurso faturável deve ter revisão explícita.
6. **Integrar somente o necessário:** não instalar todos os servidores Oracle nem adicionar SDK/MCP ao app cliente sem uma necessidade comprovada.

## Arquitetura-alvo

- Agentes administrativos -> Oracle Cloud MCP -> OCI.
- Aplicativo Urbico -> API de backend HTTPS.
- Supabase Auth continua responsável pela identidade enquanto o fluxo atual é validado.
- Banco e serviços de mobilidade permanecem componentes separados; migrações devem ser planejadas e testadas.

## Estado

- [x] Repositório oficial Oracle MCP consultado.
- [x] Identificada a opção geral recomendada: OCI Cloud MCP Server.
- [x] Separadas as funções de administração OCI e runtime do Urbico.
- [x] Definida adoção incremental, priorizando leitura e mínimo privilégio.
- [ ] Confirmar acesso OCI e região da tenancy.
- [ ] Inspecionar recursos OCI atualmente existentes.
- [ ] Validar configuração MCP no ambiente administrativo.
- [ ] Implantar ou migrar o backend somente após auditoria de recursos, custos e segredos.

## Fontes

- https://github.com/oracle/mcp
- https://docs.oracle.com/en-us/iaas/Content/API/Concepts/sdkconfig.htm

## Regra operacional

Não gravar tokens, chaves privadas, segredos Supabase, senhas ou arquivos OCI de credenciais no Git. Não provisionar recursos com custo nem executar operações destrutivas sem confirmar plano, permissões, custos e impacto.
