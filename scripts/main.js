import { MODULE_ID, extractFloralistSheetData, buildProjectFuChatCard } from "./floralist-data.js";
import { FloralistGardenHUD } from "./floralist-app.js";

let floralistHud = null;

Hooks.once("init", () => {
  floralistHud = new FloralistGardenHUD();

  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = {
      hud: floralistHud,
      toggle: () => floralistHud?.toggle(),
      open: () => floralistHud?.open(),
      close: () => floralistHud?.close()
    };
  }
});

Hooks.once("ready", () => {
  // Sincronização instantânea via Socket entre todos os clientes conectados
  game.socket.on(`module.${MODULE_ID}`, (payload) => {
    if (!payload || payload.senderId === game.user.id) return;
    if (payload.type === "gardenStateUpdated" && floralistHud?.isOpen) {
      floralistHud.render();
    }
  });
});

/**
 * Adiciona o botão principal da Floralista na coluna de camadas (#scene-controls),
 * posicionado logo abaixo do botão de Cartas.
 */
Hooks.on("getSceneControlButtons", (controls) => {
  if (Array.isArray(controls)) {
    // Foundry v12
    controls.push({
      name: "fu-floralist",
      title: "Floralista — Jardim & Relógio de Germinação",
      icon: "fas fa-seedling",
      layer: "tokens",
      button: true,
      visible: true,
      onClick: () => floralistHud?.toggle(),
      tools: [],
      activeTool: ""
    });
  } else if (controls && typeof controls === "object") {
    // Foundry v13
    controls["fu-floralist"] = {
      name: "fu-floralist",
      title: "Floralista — Jardim & Relógio de Germinação",
      icon: "fas fa-seedling",
      order: 999,
      button: true,
      visible: true,
      onChange: () => floralistHud?.toggle(),
      onClick: () => floralistHud?.toggle(),
      tools: {
        "fu-floralist-toggle": {
          name: "fu-floralist-toggle",
          title: "Abrir / Fechar Jardim",
          icon: "fas fa-seedling",
          button: true,
          visible: true,
          onChange: () => floralistHud?.toggle(),
          onClick: () => floralistHud?.toggle()
        }
      },
      activeTool: "fu-floralist-toggle"
    };
  }
});

/**
 * Garante o disparo do clique no botão da barra lateral no Foundry v12 e v13
 * sem desativar a camada atual (Tokens).
 */
Hooks.on("renderSceneControls", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  const controlBtn = root.querySelector(
    '[data-control="fu-floralist"], [data-tool="fu-floralist"]'
  );

  if (controlBtn && !controlBtn.dataset.fuFloralBound) {
    controlBtn.dataset.fuFloralBound = "true";
    controlBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      floralistHud?.toggle();
    });
  }
});

/**
 * Atualiza o modal em tempo real sempre que a ficha do ator ou seus itens mudarem.
 */
Hooks.on("updateActor", (actor, changed) => {
  if (!floralistHud?.isOpen) return;
  const target = floralistHud.resolveTargetActor();
  if (!target || target.id !== actor.id) return;

  if (changed.flags?.[MODULE_ID] || changed.system) {
    floralistHud.render();
  }
});

for (const itemHook of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(itemHook, (item) => {
    if (!floralistHud?.isOpen) return;
    const target = floralistHud.resolveTargetActor();
    if (target && item.parent?.id === target.id) {
      floralistHud.render();
    }
  });
}

/**
 * Vincula ações interativas nos botões nativos das mensagens de chat do módulo.
 */
Hooks.on("renderChatMessage", (_message, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  root.querySelectorAll("[data-fu-floral-action]").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const action = btn.dataset.fuFloralAction;
      const actorId = btn.dataset.actorId;
      const actor = game.actors?.get(actorId);
      if (!actor) return;

      if (!game.user.isGM && !actor.isOwner) {
        ui.notifications?.warn("Apenas o proprietário deste personagem pode executar esta ação.");
        return;
      }

      const data = extractFloralistSheetData(actor);
      if (!data) return;

      if (action === "tree-of-life" && data.skills.treeOfLife) {
        const tol = data.skills.treeOfLife;
        const content = buildProjectFuChatCard({
          icon: tol.item.img,
          title: `Árvore da Vida (NP ${tol.level})`,
          subtitle: `${actor.name} • Alvo em Crise`,
          tags: ["Floralista", "Árvore da Vida", "Cura"],
          descriptionHtml: `
            <p>Uma criatura visível em <strong>Crise</strong> escolhida por <strong>${actor.name}</strong> recupera Pontos de Vida.</p>
            <hr />
            <ul>
              <li><strong>O Alvo Recupera:</strong> @GAIN[${tol.healAmount} hp]{${tol.healAmount} PV}</li>
            </ul>
          `
        });
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
      }

      if (action === "free-attack" && data.skills.battleGardening) {
        const weaponNames = data.weapons.map((w) => w.name).join(", ") || "Arma equipada";
        const content = buildProjectFuChatCard({
          icon: data.skills.battleGardening.item.img,
          title: "Jardinagem Marcial: Ataque Livre",
          subtitle: actor.name,
          tags: ["Jardinagem Marcial", "Ataque Gratuito", "RA = 0"],
          descriptionHtml: `
            <p><strong>${actor.name}</strong> realiza um <strong>ataque livre</strong> com uma arma equipada (<em>${weaponNames}</em>).</p>
            <p><strong>Regra:</strong> Trate a Rolagem Alta (RA) do Teste de Precisão como igual a <strong>0</strong> ao determinar o dano.</p>
          `
        });
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
      }

      if (action === "free-spell" && data.skills.battleGardening) {
        const bg = data.skills.battleGardening;
        const spellList = data.spells.map((s) => s.name).join(", ") || "Feitiços conhecidos";
        const content = buildProjectFuChatCard({
          icon: bg.item.img,
          title: "Jardinagem Marcial: Feitiço Grátis",
          subtitle: actor.name,
          tags: ["Jardinagem Marcial", `Custo ≤ ${bg.maxSpellMp} PM`, "RA = 0"],
          descriptionHtml: `
            <p><strong>${actor.name}</strong> realiza a ação <strong>Feitiço</strong> gratuitamente, conjurando um feitiço com custo total igual ou inferior a <strong>${bg.maxSpellMp} PM</strong> (pagando seu custo normal em PM).</p>
            <p><strong>Feitiços na ficha:</strong> ${spellList}</p>
            <p><strong>Regra:</strong> Trate a Rolagem Alta (RA) do Teste de Magia como igual a <strong>0</strong> ao determinar o dano.</p>
          `
        });
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
      }

      if (action === "free-study" && data.skills.greaterChloromancy) {
        const gc = data.skills.greaterChloromancy;
        const content = buildProjectFuChatCard({
          icon: gc.item.img,
          title: "Cloromancia Maior: Estudar Grátis",
          subtitle: actor.name,
          tags: ["Cloromancia Maior", "Ação Estudar Grátis", `+${gc.studyBonus} no Teste`],
          descriptionHtml: `
            <p><strong>${actor.name}</strong> realiza a ação <strong>Estudar</strong> gratuitamente, recebendo um bônus de <strong>+${gc.studyBonus}</strong> (NP em Jardinagem Marcial) no Teste.</p>
          `
        });
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
      }

      if (action === "free-inventory" && data.skills.greaterChloromancy) {
        const gc = data.skills.greaterChloromancy;
        const content = buildProjectFuChatCard({
          icon: gc.item.img,
          title: "Cloromancia Maior: Inventário Grátis",
          subtitle: actor.name,
          tags: ["Cloromancia Maior", "Ação Inventário Grátis"],
          descriptionHtml: `
            <p><strong>${actor.name}</strong> realiza a ação <strong>Inventário</strong> gratuitamente para criar um <strong>Remédio</strong>, <strong>Elixir</strong> ou <strong>Tônico</strong>.</p>
          `
        });
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
      }
    });
  });
});
