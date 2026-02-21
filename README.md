# Vendas

## Tela de Produtos

- Criar um produto com `parent_id`, onde o produto pode estar relacionado a outro (Tipo categorias).
- Fazer uma lista como na parte de Categorias, onde em cada card vai ter
  1. Adicionar Produto vinculado ao produto do card.
  2. `Options` para criar comissão vinculada ao produto.
  3. Desativar produto
  4. Excluir produto.

  ### Adicionar Produto
  - Nome do Produto
  - Descrição do produto
  - Comissões
    - Comissão varia por tipo de vendedor?
    - Sim
      - Adicionar/remover cenário
      - Quem vende? (papel, Vendedor, Parceiro ...)
      - Ter abas, onde sempre que eu adicionar um cenário ele adiciona uma aba
      - Só posso ter um cenário por papel
    - Adiciona comissão normal (Sim ou Não)
      - Posso adicionar uma linha de comissão
      - Nome, Papel (Vendedor, Parceiro, Unidade, Supervisor), Parcelas, % de comissão
      - Posso excluir a comissão adicionada

### Ao cadastrar a venda
  - Produto (Separado por `>` para cada produto vinculado, ex: Consórcio > Veículos > Pesados)
  - Valor Total (esse valor vai ser com base na comissão)
  - Observações
  - Comissões
    - Posso adicionar uma comissão
    - Ao selecionar o produto e ter regras de comissões atreladas ao produto, já mostra na tela de comissões.

# Dashboard
  - Vendas Recentes
    - Onde vai aparecer as últimas vendas cadastradas em tempo real
    - Não é alterada pelo filtro de data
    - Campos
      - Nome
      - Status (aprovada, pendente, concluída)
      - Valor total
      - Comissão gerada
      - Produto
      - Data
  - Summary
    - Vendas totais
    - Comissão recebida no mês
    - Receita total
    - Vendas feitas, quantidade e valor
