# Material para as lojas — Dívida Zero

Textos e respostas prontos para preencher as fichas da Google Play e da App Store.
As URLs abaixo já estão no ar.

## URLs obrigatórias

| Campo | URL |
| --- | --- |
| Site do app | https://julio.api.br/app/dividazero/ |
| Política de Privacidade | https://julio.api.br/app/dividazero/privacidade |
| Termos de Uso | https://julio.api.br/app/dividazero/termos |
| Suporte | https://julio.api.br/app/dividazero/suporte |
| Exclusão de dados (Play) | https://julio.api.br/app/dividazero/excluir-dados |
| E-mail de contato | juliolemosdf@gmail.com |

---

## Identificação

- **Nome:** Dívida Zero
- **Subtítulo (App Store, 30 car.):** Controle de contas e parcelas
- **Descrição curta (Play, 80 car.):** Separe contas fixas de parcelas, veja onde vai seu dinheiro e quite antes.
- **Categoria:** Finanças
- **Classificação etária:** Livre / 4+
- **Idioma:** Português (Brasil)
- **Preço:** Gratuito, sem compras no app
- **Bundle ID / Package:** com.dividazero.app

## Palavras-chave (App Store, 100 caracteres)

```
finanças,orçamento,parcelas,dívidas,contas,gastos,economia,metas,salário,controle
```

## Descrição completa

```
O Dívida Zero organiza o seu dinheiro do jeito que ele realmente acontece: tem
conta que se repete todo mês, tem compra parcelada que um dia acaba e tem gasto
que aconteceu só uma vez. A maioria dos apps joga tudo na mesma lista. Aqui,
cada coisa fica no seu lugar — com subtotal — e você enxerga na hora quanto do
mês é compromisso permanente e quanto vai se encerrar sozinho.

O QUE VOCÊ CONSEGUE FAZER

• Ver o mês inteiro numa tela: quanto entrou, quanto saiu, o que já foi pago,
  o que está atrasado e quanto sobrou.
• Acompanhar a porcentagem da sua renda que já está comprometida.
• Separar despesas fixas, compras parceladas e gastos avulsos.
• Excluir uma compra parcelada de verdade: o app pergunta se você quer remover
  só aquela parcela, esta e as próximas, ou a compra inteira — e mostra quantos
  lançamentos cada opção apaga.
• Editar sem bagunçar o histórico: aplique a mudança só neste mês, daqui pra
  frente, ou em tudo.
• Montar um plano de quitação, escolher entre bola de neve ou maior alívio e
  descobrir em que mês você fica livre das parcelas.
• Criar metas de economia, registrar aportes e ver o quanto falta.
• Analisar a evolução dos gastos em 6, 12 ou 24 meses, com tendência e ranking
  de categorias.
• Receber lembrete na véspera do vencimento das contas.
• Registrar dinheiro emprestado e cobrar pelo WhatsApp com a mensagem pronta.
• Calcular salário líquido (INSS e IRRF), rescisão, férias e juros (Price e SAC).
• Alternar entre tema claro e escuro.

SEUS DADOS FICAM NO SEU CELULAR

Não existe cadastro, login ou nuvem. Salário, contas, parcelas e metas ficam
gravados apenas no seu aparelho e não são enviados para lugar nenhum. Sem
anúncios e sem rastreamento.

Em troca, o backup é responsabilidade sua: exporte seus dados de vez em quando
em Ajustes e Dados. Se desinstalar o app sem backup, as informações são perdidas.

IMPORTANTE

O Dívida Zero é uma ferramenta de organização pessoal. Ele não se conecta a
bancos, não movimenta dinheiro e não presta consultoria financeira ou
trabalhista. Os cálculos servem como estimativa e conferência.
```

## Novidades desta versão (1.2.0)

```
• Visual novo, mais claro e limpo, com tema escuro.
• Despesas separadas em fixas, parceladas e avulsas, cada uma com subtotal.
• Correção importante: excluir uma compra parcelada agora pergunta se você quer
  remover só a parcela, esta e as próximas, ou a compra inteira.
• Editar despesa recorrente agora deixa escolher o alcance da alteração.
• Nova área de Metas, com aportes e previsão de conclusão.
• Novo Plano de Quitação, com estratégias e data de saída das parcelas.
• Nova tela de Análise, com evolução de 6 a 24 meses e ranking de categorias.
• Seus dados anteriores são preservados na atualização.
```

---

## Google Play — Segurança dos dados

| Pergunta | Resposta |
| --- | --- |
| O app coleta ou compartilha dados do usuário? | Coleta (apenas dados de uso). |
| Os dados são compartilhados com terceiros? | Não. |
| Dados financeiros são coletados? | Não. Ficam somente no dispositivo. |
| Tipo coletado | **Apps e desempenho → Interações no app** (abertura do app e tela visitada). |
| Identificadores | Identificador gerado no dispositivo, transmitido apenas como hash SHA-256. Não é ID de publicidade. |
| Dados são criptografados em trânsito? | Sim (HTTPS). |
| Usuário pode pedir exclusão? | Sim — https://julio.api.br/app/dividazero/excluir-dados |
| Coleta obrigatória? | Não. Sem internet, nada é enviado e o app funciona normalmente. |
| Finalidade | Análise de uso do aplicativo. |
| Publicidade / rastreamento | Nenhum SDK de anúncio ou rastreamento. |

## App Store — Privacidade (Nutrition Labels)

- **Dados usados para rastrear você:** nenhum.
- **Dados vinculados a você:** nenhum.
- **Dados não vinculados a você:** *Dados de uso → Dados de interação com o produto*
  e *Identificadores → ID do dispositivo* (identificador aleatório gerado no app,
  enviado como hash; não é o IDFA).
- **App Tracking Transparency:** não se aplica — o app não rastreia entre apps
  nem usa o IDFA.

---

## Pendências antes de enviar

1. **Face ID declarado mas não usado.** `app.json` traz `NSFaceIDUsageDescription`
   e a dependência `expo-local-authentication`, mas nenhuma tela usa biometria.
   A Apple costuma questionar permissão declarada sem uso. Remova a chave e a
   dependência, ou implemente o bloqueio por biometria antes de enviar.
2. **Links das lojas na landing.** O `index.html` mostra "Em breve na Google Play
   e na App Store". Depois de publicar, troque os dois botões do hero pelos links
   reais das fichas.
3. **Capturas para as fichas.** As imagens em
   `/var/www/dividazero/app/dividazero/ativos/tela-*.png` estão redimensionadas
   para a web (330 px). Para as lojas, gere novamente em resolução cheia
   (1206×2622 no iPhone 6.9"), sem redimensionar.
