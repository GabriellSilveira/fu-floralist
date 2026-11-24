# Fabula Ultima - Floralista (PT-BR)

Módulo para **Foundry VTT (v12 e v13)** dedicado à classe **Floralista** (`fuid: "floralist"`) no sistema **Fabula Ultima (`projectfu`)**, totalmente em Português (PT-BR).

## Funcionalidades

- **HUD Flutuante Ilustrado:** Janela arrastável (com posição salva no `localStorage`), botão e duplo clique para minimizar em barra compacta e acesso rápido pelo ícone de broto (`🌱`) na barra lateral esquerda (`#scene-controls`).
- **Relógio de Germinação Interativo:** Suporta tanto a variante padrão de **4 seções** quanto a variante de **3 seções**, permitindo clicar diretamente nas fatias ou avançar o turno com disparo automático dos efeitos no chat.
- **Leitura Automática da Ficha:** Sincroniza nível do personagem (incluindo o bônus de **Nível 30+**), PM atual/máximo, Níveis de Perícia (`Cloromancia`, `Enxerto`, `Árvore da Vida`, `Jardinagem Marcial`, `Influência Verdejante` e `Cloromancia Maior`) e magissementes descobertas.
- **Sincronização Multiplayer:** Estado persistido via `actor.setFlag` e sincronizado em tempo real entre Mestre e jogadores via `game.socket`.
- **Chat Nativo `projectfu`:** Cards formatados com classes e enrichers nativos (`@GAIN[...]`, `@DMG[...]`, `@EFFECT[...]`, `@TYPE[...]`).

## Instalação via Manifest URL

1. No Foundry VTT, acesse **Módulos Complementares > Instalar Módulo**.
2. Cole a URL do manifesto abaixo no campo **Manifest URL**:
   ```text
   https://github.com/GabriellSilveira/fu-floralist/releases/latest/download/module.json