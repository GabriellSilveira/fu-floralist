export const MODULE_ID = "fu-floralist";

export const FLORALIST_CLASS_FUIDS = ["floralist", "florist"];

export const DEFAULT_GARDEN_STATE = {
  plantedFuid: null,
  plantedItemId: null,
  clockCurrent: 0,
  clockMax: 4,
  deductMp: true
};

/**
 * Catálogo base das Magissementes em PT-BR com fórmulas dinâmicas.
 * Também serve de enriquecimento para os itens lidos diretamente da ficha.
 */
export const MAGISEED_CATALOG = {
  "golden-ginkgo": {
    fuid: "golden-ginkgo",
    name: "Ginkgo Dourado",
    defaultImg: "systems/projectfu/styles/static/compendium/classes/floralist/magiseeds/golden-ginkgo.png",
    accent: "#eab308",
    timing: "Fim do Turno",
    stages: [
      {
        min: 1,
        max: 1,
        label: "1 Seção",
        summary: "Cura Abalado, Atordoado e Enfurecido em você e aliados visíveis.",
        buildChatHtml: () => `
          <p>No fim do seu turno, você e todos os aliados que você possa ver se recuperam das condições: <strong>Abalado</strong>, <strong>Atordoado</strong> e/ou <strong>Enfurecido</strong>.</p>
        `
      },
      {
        min: 2,
        max: 3,
        label: "2–3 Seções",
        summary: "Recupera 【5 + NP Cloromancia】 PM (+10 no Nv 30+) em você e aliados.",
        buildChatHtml: ({ chloromancySL, levelBonusResource }) => {
          const totalMp = 5 + chloromancySL + levelBonusResource;
          const bonusNote = levelBonusResource > 0 ? ` <em>(+10 Nv 30+)</em>` : "";
          return `
            <p>No fim do seu turno, você e todos os aliados que você possa ver recuperam uma quantidade de <strong>PM</strong> igual a <strong>【5 + NP em Cloromancia (${chloromancySL})】</strong>${bonusNote}.</p>
            <hr />
            <ul>
              <li><strong>Você e seus aliados recuperam:</strong> @GAIN[${totalMp} mp]{${totalMp} PM}</li>
            </ul>
          `;
        }
      }
    ]
  },

  "remedy-lily": {
    fuid: "remedy-lily",
    name: "Lírio Medicinal",
    defaultImg: "systems/projectfu/styles/static/compendium/classes/floralist/magiseeds/remedy-lily.png",
    accent: "#10b981",
    timing: "Fim do Turno",
    stages: [
      {
        min: 1,
        max: 1,
        label: "1 Seção",
        summary: "Cura Envenenado, Lento e Fraco em você e aliados visíveis.",
        buildChatHtml: () => `
          <p>No fim do seu turno, você e todos os aliados que você possa ver se recuperam de <strong>Envenenado</strong>, <strong>Lento</strong> e <strong>Fraco</strong>.</p>
        `
      },
      {
        min: 2,
        max: 3,
        label: "2–3 Seções",
        summary: "Recupera 【15 + NP Cloromancia】 PV (+10 no Nv 30+) em você e aliados.",
        buildChatHtml: ({ chloromancySL, levelBonusResource }) => {
          const totalHp = 15 + chloromancySL + levelBonusResource;
          const bonusNote = levelBonusResource > 0 ? ` <em>(+10 Nv 30+)</em>` : "";
          return `
            <p>No fim do seu turno, você e todos os aliados que você possa ver recuperam uma quantidade de <strong>PV</strong> igual a <strong>【15 + NP em Cloromancia (${chloromancySL})】</strong>${bonusNote}.</p>
            <hr />
            <ul>
              <li><strong>Alvos regeneram:</strong> @GAIN[${totalHp} hp]{${totalHp} PV}</li>
            </ul>
          `;
        }
      }
    ]
  },

  "serrated-rose": {
    fuid: "serrated-rose",
    name: "Rosa Serrilhada",
    defaultImg: "systems/projectfu/styles/static/compendium/classes/floralist/magiseeds/serrated-rose.png",
    accent: "#e11d48",
    timing: "Fim do Turno",
    stages: [
      {
        min: 1,
        max: 1,
        label: "1 Seção",
        summary: "1 inimigo visível à sua escolha fica Lento.",
        buildChatHtml: () => `
          <p>No fim do seu turno, você pode escolher um inimigo que você possa ver. Se fizer isso, esse inimigo fica <strong>Lento</strong>.</p>
          <hr />
          <ul>
            <li><strong>Alvo sofre:</strong> @EFFECT[slow]</li>
          </ul>
        `
      },
      {
        min: 2,
        max: 2,
        label: "2 Seções",
        summary: "Todos os inimigos visíveis ficam Lentos.",
        buildChatHtml: () => `
          <p>No fim do seu turno, todos os inimigos que você possa ver ficam <strong>Lentos</strong>.</p>
          <hr />
          <ul>
            <li><strong>Alvos sofrem:</strong> @EFFECT[slow]</li>
          </ul>
        `
      },
      {
        min: 3,
        max: 3,
        label: "3 Seções",
        summary: "Causa 【15 + NP Cloromancia】 de dano físico (+5 no Nv 30+) a inimigos Lentos.",
        buildChatHtml: ({ chloromancySL, levelBonusDamage }) => {
          const totalDmg = 15 + chloromancySL + levelBonusDamage;
          const bonusNote = levelBonusDamage > 0 ? ` <em>(+5 Nv 30+)</em>` : "";
          return `
            <p>No fim do seu turno, você causa a cada inimigo que você possa ver e que esteja <strong>Lento</strong> dano <strong>físico</strong> igual a <strong>【15 + NP em Cloromancia (${chloromancySL})】</strong>${bonusNote}.</p>
            <hr />
            <ul>
              <li><strong>Alvos perdem:</strong> @DMG[${totalDmg} physical]{${totalDmg} físico}</li>
            </ul>
          `;
        }
      }
    ]
  },

  "star-peony": {
    fuid: "star-peony",
    name: "Peônia Estrelada",
    defaultImg: "systems/projectfu/styles/static/compendium/classes/floralist/magiseeds/star-peony.png",
    accent: "#f59e0b",
    timing: "Fim do Turno",
    stages: [
      {
        min: 1,
        max: 1,
        label: "1 Seção",
        summary: "1 inimigo visível à sua escolha fica Atordoado.",
        buildChatHtml: () => `
          <p>No fim do seu turno, você pode escolher um inimigo que você possa ver. Se fizer isso, esse inimigo fica <strong>Atordoado</strong>.</p>
          <hr />
          <ul>
            <li><strong>Alvo sofre:</strong> @EFFECT[dazed]</li>
          </ul>
        `
      },
      {
        min: 2,
        max: 2,
        label: "2 Seções",
        summary: "Todos os inimigos visíveis ficam Atordoados.",
        buildChatHtml: () => `
          <p>No fim do seu turno, todos os inimigos que você possa ver ficam <strong>Atordoados</strong>.</p>
          <hr />
          <ul>
            <li><strong>Alvos sofrem:</strong> @EFFECT[dazed]</li>
          </ul>
        `
      },
      {
        min: 3,
        max: 3,
        label: "3 Seções",
        summary: "Causa 【15 + NP Cloromancia】 de dano de Luz (+5 no Nv 30+) a inimigos Atordoados.",
        buildChatHtml: ({ chloromancySL, levelBonusDamage }) => {
          const totalDmg = 15 + chloromancySL + levelBonusDamage;
          const bonusNote = levelBonusDamage > 0 ? ` <em>(+5 Nv 30+)</em>` : "";
          return `
            <p>No fim do seu turno, você causa a cada inimigo que você possa ver e que esteja <strong>Atordoado</strong> dano de <strong>Luz</strong> igual a <strong>【15 + NP em Cloromancia (${chloromancySL})】</strong>${bonusNote}.</p>
            <hr />
            <ul>
              <li><strong>Alvos perdem:</strong> @DMG[${totalDmg} light]{${totalDmg} Luz}</li>
            </ul>
          `;
        }
      }
    ]
  },

  "wardwattle": {
    fuid: "wardwattle",
    name: "Muralha de Espinhos",
    defaultImg: "systems/projectfu/styles/static/compendium/classes/floralist/magiseeds/wardwattle.png",
    accent: "#16a34a",
    timing: "Passivo",
    stages: [
      {
        min: 0,
        max: 1,
        label: "0–1 Seções",
        summary: "Passivo: Você possui Resistência a dano físico.",
        buildChatHtml: () => `
          <p>Você tem <strong>Resistência</strong> a dano <strong>físico</strong>.</p>
          <hr />
          <ul>
            <li><strong>Você recebe:</strong> @TYPE[affinity physical resistance e:eot i:1 t:source]</li>
          </ul>
        `
      },
      {
        min: 2,
        max: 2,
        label: "2 Seções",
        summary: "Resistência física + atacante corpo a corpo sofre 【5 + NP Cloromancia】 físico.",
        buildChatHtml: ({ chloromancySL, levelBonusDamage }) => {
          const totalDmg = 5 + chloromancySL + levelBonusDamage;
          const bonusNote = levelBonusDamage > 0 ? ` <em>(+5 Nv 30+)</em>` : "";
          return `
            <p>Você tem <strong>Resistência</strong> a dano <strong>físico</strong>. Além disso, uma criatura que atingir você com um <strong>ataque corpo a corpo</strong> sofre dano <strong>físico</strong> igual a <strong>【5 + NP em Cloromancia (${chloromancySL})】</strong>${bonusNote} (depois que o ataque dela for resolvido).</p>
            <hr />
            <ul>
              <li><strong>Você recebe:</strong> @TYPE[affinity physical resistance e:eot i:1 t:source]</li>
              <li><strong>Alvo perde:</strong> @DMG[${totalDmg} physical]{${totalDmg} físico}</li>
            </ul>
          `;
        }
      },
      {
        min: 3,
        max: 3,
        label: "3 Seções",
        summary: "Resistência física + atacante corpo a corpo sofre 【5 + NP】 físico e 【5 + NP】 Veneno.",
        buildChatHtml: ({ chloromancySL, levelBonusDamage }) => {
          const totalDmg = 5 + chloromancySL + levelBonusDamage;
          const bonusNote = levelBonusDamage > 0 ? ` <em>(+5 Nv 30+)</em>` : "";
          return `
            <p>Você tem <strong>Resistência</strong> a dano <strong>físico</strong>. Além disso, uma criatura que atingir você com um <strong>ataque corpo a corpo</strong> sofre dano <strong>físico</strong> igual a <strong>【5 + NP em Cloromancia (${chloromancySL})】</strong>${bonusNote} e dano de <strong>Veneno</strong> igual a <strong>【5 + NP em Cloromancia (${chloromancySL})】</strong>${bonusNote} (ambos acontecem depois que o ataque dela for resolvido).</p>
            <hr />
            <ul>
              <li><strong>Você recebe:</strong> @TYPE[affinity physical resistance e:eot i:1 t:source]</li>
              <li><strong>Alvo perde:</strong> @DMG[${totalDmg} physical]{${totalDmg} físico} e @DMG[${totalDmg} poison]{${totalDmg} Veneno}</li>
            </ul>
          `;
        }
      }
    ]
  }
};

/**
 * Extrai todos os dados relevantes da Floralista a partir do Ator no Foundry.
 */
export function extractFloralistSheetData(actor) {
  if (!actor) return null;

  const items = Array.from(actor.items || []);
  const byFuid = (fuid) => items.find((i) => i.system?.fuid === fuid);

  const floralistClass = items.find(
    (i) => i.type === "class" && FLORALIST_CLASS_FUIDS.includes(i.system?.fuid)
  );

  const chloromancyItem = byFuid("chloromancy");
  const graftItem = byFuid("graft");
  const treeOfLifeItem = byFuid("tree-of-life");
  const battleGardeningItem = byFuid("battle-gardening");
  const verdantSwayItem = byFuid("verdant-sway");
  const greaterChloromancyItem = byFuid("greater-chloromancy");
  const gardenItem = byFuid("garden");

  const actorLevel = Number(actor.system?.level?.value ?? 1);
  const mpCurrent = Number(actor.system?.resources?.mp?.value ?? 0);
  const mpMax = Number(actor.system?.resources?.mp?.max ?? 0);

  const chloromancySL = Number(chloromancyItem?.system?.level?.value ?? 1);
  const graftSL = Number(graftItem?.system?.level?.value ?? 0);
  const treeOfLifeSL = Number(treeOfLifeItem?.system?.level?.value ?? 0);
  const battleGardeningSL = Number(battleGardeningItem?.system?.level?.value ?? 0);
  const verdantSwaySL = Number(verdantSwayItem?.system?.level?.value ?? 0);

  // Regra oficial: Nível 30 ou acima concede +5 dano e +10 cura/perda de PV/PM nas magissementes
  const levelBonusDamage = actorLevel >= 30 ? 5 : 0;
  const levelBonusResource = actorLevel >= 30 ? 10 : 0;

  // Coleta as magissementes descobertas diretamente dos itens da ficha
  const sheetMagiseedItems = items.filter(
    (i) =>
      i.type === "classFeature" &&
      (i.system?.featureType === "projectfu.magiseed" || Boolean(MAGISEED_CATALOG[i.system?.fuid]))
  );

  const magiseeds = sheetMagiseedItems.map((item) => {
    const fuid = item.system?.fuid || item.name.slugify();
    const catalogEntry = MAGISEED_CATALOG[fuid];

    if (catalogEntry) {
      return {
        ...catalogEntry,
        itemId: item.id,
        name: item.name || catalogEntry.name,
        img: item.img || catalogEntry.defaultImg
      };
    }

    // Fallback dinâmico caso o jogador adicione novas magissementes do compêndio no futuro
    const rawEffects = item.system?.data?.effects || [];
    return {
      fuid,
      itemId: item.id,
      name: item.name,
      img: item.img || "systems/projectfu/styles/static/compendium/classes/floralist/graft.png",
      accent: "#4ade80",
      timing: "Magissemente",
      stages: rawEffects.map((eff) => ({
        min: Number(eff.start ?? 0),
        max: Number(eff.end ?? 3),
        label: eff.start === eff.end ? `${eff.start} Seção` : `${eff.start}–${eff.end} Seções`,
        summary: eff.effect?.replace(/<[^>]+>/g, " ").trim().slice(0, 90) || "Efeito ativo",
        buildChatHtml: () => eff.effect || "<p>Efeito da magissemente.</p>"
      }))
    };
  });

  // Armas equipadas e feitiços elegíveis para Jardinagem Marcial
  const weapons = items.filter((i) => i.type === "weapon");
  const maxSpellMp = 5 + battleGardeningSL * 5;
  const spells = items.filter((i) => i.type === "spell");

  return {
    actor,
    actorId: actor.id,
    actorName: actor.name,
    actorImg: actor.img,
    actorLevel,
    mpCurrent,
    mpMax,
    hasFloralistClass: Boolean(floralistClass),
    floralistClass,
    skills: {
      garden: gardenItem || null,
      chloromancy: chloromancyItem
        ? { item: chloromancyItem, level: chloromancySL }
        : null,
      graft: graftItem
        ? { item: graftItem, level: graftSL }
        : null,
      treeOfLife: treeOfLifeItem
        ? { item: treeOfLifeItem, level: treeOfLifeSL, healAmount: 5 + treeOfLifeSL * 5 }
        : null,
      battleGardening: battleGardeningItem
        ? { item: battleGardeningItem, level: battleGardeningSL, maxSpellMp }
        : null,
      verdantSway: verdantSwayItem
        ? { item: verdantSwayItem, level: verdantSwaySL }
        : null,
      greaterChloromancy: greaterChloromancyItem
        ? { item: greaterChloromancyItem, studyBonus: battleGardeningSL }
        : null
    },
    formulas: {
      chloromancySL,
      levelBonusDamage,
      levelBonusResource
    },
    magiseeds,
    weapons,
    spells
  };
}

/**
 * Retorna o estágio ativo da magissemente para uma contagem exata do Relógio de Germinação.
 */
export function getActiveStageForClock(magiseed, clockCount) {
  if (!magiseed || !Array.isArray(magiseed.stages)) return null;
  return (
    magiseed.stages.find((s) => clockCount >= s.min && clockCount <= s.max) || null
  );
}

/**
 * Constrói o HTML de mensagem no chat seguindo exatamente o padrão nativo do projectfu.
 */
export function buildProjectFuChatCard({
  icon,
  title,
  subtitle = "",
  tags = [],
  descriptionHtml = "",
  footerButtonsHtml = ""
}) {
  const tagsHtml = tags.length
    ? `
      <div class="pfu-chat-message__toggle-section pfu-tags">
        ${tags.map((t) => `<span class="fu-tag">${t}</span>`).join("")}
      </div>
    `
    : "";

  return `
    <div class="pfu-chat-message fu-floralist-chat-card">
      <div class="pfu-chat-message__header flexrow" style="align-items: center; gap: 8px; border-bottom: 1px solid rgba(0,0,0,0.15); padding-bottom: 5px; margin-bottom: 6px;">
        <img src="${icon}" width="36" height="36" style="border: 1px solid #4a5568; border-radius: 4px; flex: 0 0 36px; object-fit: cover;" />
        <div style="flex: 1; min-width: 0;">
          <h3 style="margin: 0; font-variant: small-caps; font-weight: 700; font-size: 1.15em; line-height: 1.15;">${title}</h3>
          ${subtitle ? `<div style="font-size: 0.8em; opacity: 0.8;">${subtitle}</div>` : ""}
        </div>
      </div>
      ${tagsHtml}
      <div class="pfu-chat-message__toggle-section description chat-desc">
        <details open="">
          <summary class="collapsible-description align-center">Descrição</summary>
          <div class="pfu-chat-message__description" style="padding-top: 4px;">
            ${descriptionHtml}
          </div>
        </details>
      </div>
      ${footerButtonsHtml ? `<div class="fu-floralist-chat-actions" style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">${footerButtonsHtml}</div>` : ""}
    </div>
  `;
}