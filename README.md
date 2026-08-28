# 0low Connect V3 — funcional

Esta versão foi feita para funcionar como um pequeno Discord próprio:
- servidor de um lado
- criar servidor
- entrar por código
- convite por código/link
- chat em tempo real
- lista de membros online
- call com câmera + microfone
- compartilhamento de tela
- controles de microfone/câmera
- configurações de nome
- layout mobile e desktop

## Rodar
Instale Node.js 20+ e execute:
npm install
npm start

Depois abra:
http://localhost:3000

## Para seu amigo entrar
Os dois precisam acessar a **mesma URL pública** quando o projeto estiver hospedado.
Você cria o servidor, copia o código pelo botão 🔗 e manda para ele.

## Colocar online
Hospede este projeto em um serviço que rode Node.js (por exemplo, Render, Railway ou VPS) e deixe o processo `npm start`.
Use HTTPS. Câmera, microfone e compartilhamento de tela normalmente exigem contexto seguro.

## Limitações desta base
Os servidores ficam em memória e somem se o processo reiniciar. Para um produto completo ainda seriam necessários banco de dados, contas, autenticação, permissões, uploads, moderação, TURN para melhorar conexões WebRTC e um sistema de pagamentos se o Nitro for cobrado.
