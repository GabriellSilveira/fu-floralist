import {
  MODULE_ID,
  FLORALIST_CLASS_FUIDS,
  DEFAULT_GARDEN_STATE,
  extractFloralistSheetData,
  getActiveStageForClock,
  buildHintDetails,
  buildProjectFuChatCard
} from "./floralist-data.js";

const POS_STORAGE_KEY = "fu-floralist.windowPosition";
const MINIMIZED_STORAGE_KEY = "fu-floralist.windowMinimized";

export class FloralistGardenHUD {
  constructor() {
    this.element = null;
    this.hintElement = null;
    this.isOpen = false;
    this.isMinimized = localStorage.getItem(MINIMIZED_STORAGE_KEY) === "true";
    this.selectedActorId = null;
    this._dragState = null;
    this._outsideClickHandler = null;
  }

  /**
   * Detecta automaticamente o ator Floralista, priorizando game.user.character.
   */
  resolveTargetActor() {
    const hasFloralist = (actor) =>
      actor?.items?.some(
        (i) => i.type === "class" && FLORALIST_CLASS_FUIDS.includes(i.system?.fuid)
      );

    if (this.selectedActorId) {
      const explicit = game.actors?.get(this.selectedActorId);
      if (explicit && hasFloralist(explicit)) return explicit;
    }

    if (game.user?.character && hasFloralist(game.user.character)) {
      this.selectedActorId = game.user.character.id;
      return game.user.character;
    }

    const ownedFloralist = game.actors?.find((a) => a.isOwner && hasFloralist(a));
    if (ownedFloralist) {
      this.selectedActorId = ownedFloralist.id;
      return ownedFloralist;
    }

    const anyFloralist = game.actors?.find((a) => hasFloralist(a));
    if (anyFloralist) {
      this.selectedActorId = anyFloralist.id;
      return anyFloralist;
    }

    return null;
  }

  getAllFloralistActors() {
    return (game.actors?.contents || []).filter((a) =>
      a.items?.some(
        (i) => i.type === "class" && FLORALIST_CLASS_FUIDS.includes(i.system?.fuid)
      )
    );
  }

  canControl(actor) {
    if (!actor) return false;
    return Boolean(game.user?.isGM || actor.isOwner);
  }

  getGardenState(actor) {
    const flag = actor?.getFlag(MODULE_ID, "gardenState") || {};
    return {
      ...DEFAULT_GARDEN_STATE,
      ...flag
    };
  }

  async saveGardenState(actor, partialState) {
    if (!actor || !this.canControl(actor)) {
      ui.notifications?.warn("Apenas o proprietário da ficha ou o Mestre pode alterar o Jardim.");
      return null;
    }

    const current = this.getGardenState(actor);
    const nextState = {
      ...current,
      ...partialState
    };

    await actor.setFlag(MODULE_ID, "gardenState", nextState);

    game.socket.emit(`module.${MODULE_ID}`, {
      type: "gardenStateUpdated",
      actorId: actor.id,
      state: nextState,
      senderId: game.user.id
    });

    this.render();
    return nextState;
  }

  /**
   * Salva o ciclo de sessões (3 ou 4) diretamente no item da Magissemente na ficha.
   */
  async setSeedClockSections(sheetData, seedFuid, sections) {
    const actor = sheetData?.actor;
    if (!actor || !this.canControl(actor)) return;

    const seed = sheetData.magiseeds.find((m) => m.fuid === seedFuid);
    if (seed?.item) {
      await seed.item.setFlag(MODULE_ID, "clockSections", Number(sections));
    }

    const state = this.getGardenState(actor);
    if (state.plantedFuid === seedFuid) {
      await this.saveGardenState(actor, {
        clockMax: Number(sections),
        clockCurrent: Math.min(state.clockCurrent, Number(sections) - 1)
      });
    } else {
      this.render();
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.render();
  }

  close() {
    this.isOpen = false;
    this.closeHint();
    if (this.element) {
      this.element.classList.add("is-closed");
      setTimeout(() => {
        if (!this.isOpen && this.element) {
          this.element.remove();
          this.element = null;
        }
      }, 240);
    }
  }

  closeHint() {
    if (this.hintElement) {
      this.hintElement.remove();
      this.hintElement = null;
    }
    if (this._outsideClickHandler) {
      document.removeEventListener("pointerdown", this._outsideClickHandler, true);
      this._outsideClickHandler = null;
    }
  }

  showHintPopover(clientX, clientY, sheetData, targetSpec) {
    this.closeHint();
    const details = buildHintDetails(sheetData, targetSpec);
    if (!details) return;

    const isEditable = this.canControl(sheetData.actor);

    const cycleSelectorHtml =
      details.seedFuid && isEditable
        ? `
          <div class="fu-hint-cycle-bar">
            <span>Relógio desta flor:</span>
            <div class="fu-hint-cycle-btns">
              <button type="button" class="fu-hint-cycle-btn ${details.clockSections === 4 ? "is-active" : ""}" data-hint-set-sections="4">4 Sessões</button>
              <button type="button" class="fu-hint-cycle-btn ${details.clockSections === 3 ? "is-active" : ""}" data-hint-set-sections="3">3 Sessões</button>
            </div>
          </div>
        `
        : "";

    const pop = document.createElement("div");
    pop.id = "fu-floralist-hint-popover";
    pop.className = "fu-floralist-hint";
    pop.innerHTML = `
      <div class="fu-hint-header">
        <img src="${details.icon}" alt="${details.title}" />
        <div class="fu-hint-titles">
          <strong>${details.title}</strong>
          <span>${details.badge}</span>
        </div>
        <button type="button" class="fu-hint-close" title="Fechar dica" aria-label="Fechar">×</button>
      </div>
      <div class="fu-hint-body">
        ${details.bodyHtml}
        ${cycleSelectorHtml}
      </div>
    `;

    document.body.appendChild(pop);
    this.hintElement = pop;

    // Posiciona próximo ao cursor sem sair da tela
    const rect = pop.getBoundingClientRect();
    const maxLeft = Math.max(12, window.innerWidth - rect.width - 14);
    const maxTop = Math.max(12, window.innerHeight - rect.height - 14);
    const posLeft = Math.min(Math.max(12, clientX + 12), maxLeft);
    const posTop = Math.min(Math.max(12, clientY - 16), maxTop);

    pop.style.left = `${posLeft}px`;
    pop.style.top = `${posTop}px`;

    pop.querySelector(".fu-hint-close")?.addEventListener("click", () => this.closeHint());

    pop.querySelectorAll("[data-hint-set-sections]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const secs = Number(btn.dataset.hintSetSections);
        await this.setSeedClockSections(sheetData, details.seedFuid, secs);
        this.showHintPopover(posLeft - 12, posTop + 16, extractFloralistSheetData(sheetData.actor), targetSpec);
      });
    });

    // Fecha ao clicar fora do popover
    this._outsideClickHandler = (ev) => {
      if (this.hintElement && !this.hintElement.contains(ev.target)) {
        this.closeHint();
      }
    };
    setTimeout(() => {
      if (this.hintElement) {
        document.addEventListener("pointerdown", this._outsideClickHandler, true);
      }
    }, 10);
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    this.closeHint();
    localStorage.setItem(MINIMIZED_STORAGE_KEY, String(this.isMinimized));
    if (this.element) {
      this.element.classList.toggle("is-minimized", this.isMinimized);
      const minBtn = this.element.querySelector("#fuFloralMinimizeBtn");
      const minIcon = this.element.querySelector("#fuFloralMinimizeIcon");
      if (minBtn) {
        minBtn.title = this.isMinimized ? "Expandir" : "Minimizar";
        minBtn.setAttribute("aria-label", this.isMinimized ? "Expandir" : "Minimizar");
      }
      if (minIcon) {
        minIcon.innerHTML = this.isMinimized
          ? '<line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />'
          : '<line x1="3" y1="11.5" x2="13" y2="11.5" />';
      }
    }
  }

  _applySavedPosition(wrapper) {
    try {
      const raw = localStorage.getItem(POS_STORAGE_KEY);
      if (!raw) return;
      const pos = JSON.parse(raw);
      if (typeof pos.left === "number" && typeof pos.top === "number") {
        const maxLeft = Math.max(12, window.innerWidth - 510);
        const maxTop = Math.max(90, window.innerHeight - 180);
        wrapper.style.left = `${Math.min(Math.max(12, pos.left), maxLeft)}px`;
        wrapper.style.top = `${Math.min(Math.max(90, pos.top), maxTop)}px`;
        wrapper.style.transform = "none";
      }
    } catch (_err) {
      // Ignora erro de parse do localStorage
    }
  }

  _bindDragEvents(wrapper) {
    const dragHandles = wrapper.querySelectorAll("[data-floral-drag-handle]");
    dragHandles.forEach((handle) => {
      handle.addEventListener("pointerdown", (ev) => {
        if (ev.target.closest("button, input, select, a")) return;
        ev.preventDefault();

        const rect = wrapper.getBoundingClientRect();
        wrapper.style.left = `${rect.left}px`;
        wrapper.style.top = `${rect.top}px`;
        wrapper.style.transform = "none";

        this._dragState = {
          startX: ev.clientX,
          startY: ev.clientY,
          origLeft: rect.left,
          origTop: rect.top
        };

        handle.setPointerCapture(ev.pointerId);
      });

      handle.addEventListener("pointermove", (ev) => {
        if (!this._dragState) return;
        const dx = ev.clientX - this._dragState.startX;
        const dy = ev.clientY - this._dragState.startY;

        const maxLeft = Math.max(8, window.innerWidth - wrapper.offsetWidth - 8);
        const maxTop = Math.max(85, window.innerHeight - 120);

        const nextLeft = Math.min(Math.max(8, this._dragState.origLeft + dx), maxLeft);
        const nextTop = Math.min(Math.max(85, this._dragState.origTop + dy), maxTop);

        wrapper.style.left = `${nextLeft}px`;
        wrapper.style.top = `${nextTop}px`;
      });

      const endDrag = () => {
        if (!this._dragState) return;
        this._dragState = null;
        localStorage.setItem(
          POS_STORAGE_KEY,
          JSON.stringify({
            left: parseFloat(wrapper.style.left) || 120,
            top: parseFloat(wrapper.style.top) || 135
          })
        );
      };

      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);

      handle.addEventListener("dblclick", (ev) => {
        if (ev.target.closest("button, input, select, a")) return;
        this.toggleMinimize();
      });
    });
  }

  /**
   * Renderiza o SVG interativo do Relógio de Germinação (3 ou 4 sessões).
   */
  _buildClockSvgHtml(clockCurrent, clockMax, isEditable) {
    const isThree = Number(clockMax) === 3;
    const uid = isThree ? "fu3" : "fu4";
    const clickClass = isEditable ? "is-clickable" : "";

    const slicesHtml = isThree
      ? `
        <path data-clock-slice="1" class="fu-clock-slice ${clockCurrent >= 1 ? "is-filled" : ""} ${clickClass}"
              d="M 215 235 L 215 123 A 112 112 0 0 1 311.99 291 Z"
              fill="${clockCurrent >= 1 ? "url(#filledSlice3)" : "#FFF8EC"}" />
        <path data-clock-slice="2" class="fu-clock-slice ${clockCurrent >= 2 ? "is-filled" : ""} ${clickClass}"
              d="M 215 235 L 311.99 291 A 112 112 0 0 1 118.01 291 Z"
              fill="${clockCurrent >= 2 ? "url(#filledSlice3)" : "#F5DEC8"}" />
        <path data-clock-slice="3" class="fu-clock-slice ${clockCurrent >= 3 ? "is-filled" : ""} ${clickClass}"
              d="M 215 235 L 118.01 291 A 112 112 0 0 1 215 123 Z"
              fill="${clockCurrent >= 3 ? "url(#filledSlice3)" : "#FCECE0"}" />

        <line x1="215" y1="235" x2="215" y2="123" stroke="#D9B99B" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="215" y1="235" x2="311.99" y2="291" stroke="#D9B99B" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="215" y1="235" x2="118.01" y2="291" stroke="#D9B99B" stroke-width="2.5" stroke-linecap="round"/>
      `
      : `
        <path data-clock-slice="1" class="fu-clock-slice ${clockCurrent >= 1 ? "is-filled" : ""} ${clickClass}"
              d="M 215 235 L 215 123 A 112 112 0 0 1 327 235 Z"
              fill="${clockCurrent >= 1 ? "url(#filledSlice4)" : "#FFF8EC"}" />
        <path data-clock-slice="2" class="fu-clock-slice ${clockCurrent >= 2 ? "is-filled" : ""} ${clickClass}"
              d="M 215 235 L 327 235 A 112 112 0 0 1 215 347 Z"
              fill="${clockCurrent >= 2 ? "url(#filledSlice4)" : "#F5DEC8"}" />
        <path data-clock-slice="3" class="fu-clock-slice ${clockCurrent >= 3 ? "is-filled" : ""} ${clickClass}"
              d="M 215 235 L 215 347 A 112 112 0 0 1 103 235 Z"
              fill="${clockCurrent >= 3 ? "url(#filledSlice4)" : "#FFF8EC"}" />
        <path data-clock-slice="4" class="fu-clock-slice ${clockCurrent >= 4 ? "is-filled" : ""} ${clickClass}"
              d="M 215 235 L 103 235 A 112 112 0 0 1 215 123 Z"
              fill="${clockCurrent >= 4 ? "url(#filledSlice4)" : "#F5DEC8"}" />

        <line x1="215" y1="123" x2="215" y2="347" stroke="#D9B99B" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="103" y1="235" x2="327" y2="235" stroke="#D9B99B" stroke-width="2.5" stroke-linecap="round"/>
      `;

    return `
      <svg class="fu-wheel-svg" viewBox="25 78 380 315" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="inner_${uid}" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#8C582B" flood-opacity="0.26"/>
          </filter>
          <filter id="drop_${uid}" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#3B200D" flood-opacity="0.22"/>
          </filter>
          <linearGradient id="rim_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FF8833"/>
            <stop offset="50%" stop-color="#F26311"/>
            <stop offset="100%" stop-color="#CC4806"/>
          </linearGradient>
          <radialGradient id="filledSlice${isThree ? "3" : "4"}" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stop-color="#A7F3D0"/>
            <stop offset="60%" stop-color="#34D399"/>
            <stop offset="100%" stop-color="#059669"/>
          </radialGradient>

          <g id="wildRose_${uid}">
            <circle cx="0" cy="-8" r="6.5" fill="#C9342B"/>
            <circle cx="7.6" cy="-2.5" r="6.5" fill="#D93F34"/>
            <circle cx="4.7" cy="6.5" r="6.5" fill="#B82A22"/>
            <circle cx="-4.7" cy="6.5" r="6.5" fill="#C9342B"/>
            <circle cx="-7.6" cy="-2.5" r="6.5" fill="#D93F34"/>
            <circle cx="0" cy="0" r="5" fill="#9E1E17"/>
            <circle cx="0" cy="0" r="2.4" fill="#F2A93B"/>
          </g>

          <path id="sharpLeaf_${uid}" d="M0 0 C6 -8 18 -8 24 0 C18 8 6 8 0 0 Z"/>
        </defs>

        <!-- 1. FOLHAS PONTIAGUDAS DE FUNDO -->
        <g>
          <use href="#sharpLeaf_${uid}" transform="translate(96, 272) rotate(-155) scale(1.4)" fill="#5E8712"/>
          <use href="#sharpLeaf_${uid}" transform="translate(106, 304) rotate(-168) scale(1.6)" fill="#4D700D"/>
          <use href="#sharpLeaf_${uid}" transform="translate(154, 356) rotate(172) scale(1.5)" fill="#5E8712"/>
          <use href="#sharpLeaf_${uid}" transform="translate(274, 356) rotate(12) scale(1.6)" fill="#5E8712"/>
          <use href="#sharpLeaf_${uid}" transform="translate(316, 336) rotate(-18) scale(1.5)" fill="#4D700D"/>
          <use href="#sharpLeaf_${uid}" transform="translate(334, 302) rotate(-42) scale(1.4)" fill="#6E9C17"/>
          <use href="#sharpLeaf_${uid}" transform="translate(132, 146) rotate(-135) scale(1.3)" fill="#5E8712"/>
          <use href="#sharpLeaf_${uid}" transform="translate(302, 142) rotate(-35) scale(1.3)" fill="#5E8712"/>
        </g>

        <!-- 2. COGUMELOS LATERAIS -->
        <g transform="translate(65, 206) rotate(-20)" filter="url(#drop_${uid})">
          <path d="M-8 6 L-11 26 C-11 30 11 30 11 26 L8 6 Z" fill="#F2E4D5"/>
          <path d="M2 6 L4 28 C8 28 11 27 11 26 L8 6 Z" fill="#DFCBB8"/>
          <path d="M-24 8 C-24 -12 24 -12 24 8 C24 13 -24 13 -24 8 Z" fill="#D93829"/>
          <circle cx="-11" cy="1" r="4" fill="#FFF8EE"/>
          <circle cx="3" cy="-3" r="5" fill="#FFF8EE"/>
          <circle cx="14" cy="3" r="3.2" fill="#FFF8EE"/>
        </g>
        <g transform="translate(72, 246) rotate(-14)" filter="url(#drop_${uid})">
          <path d="M-5 4 L-7 17 C-7 20 7 20 7 17 L5 4 Z" fill="#F2E4D5"/>
          <path d="M-16 5 C-16 -8 16 -8 16 5 C16 9 -16 9 -16 5 Z" fill="#D93829"/>
          <circle cx="-7" cy="0" r="2.8" fill="#FFF8EE"/>
          <circle cx="5" cy="-1" r="3.2" fill="#FFF8EE"/>
        </g>
        <g transform="translate(350, 188) rotate(22)" filter="url(#drop_${uid})">
          <path d="M-6 5 L-9 22 C-9 26 9 26 9 22 L6 5 Z" fill="#F2E4D5"/>
          <path d="M-20 6 C-20 -10 20 -10 20 6 C20 11 -20 11 -20 6 Z" fill="#D93829"/>
          <circle cx="-9" cy="0" r="3.4" fill="#FFF8EE"/>
          <circle cx="4" cy="-2" r="4.2" fill="#FFF8EE"/>
          <circle cx="12" cy="3" r="2.6" fill="#FFF8EE"/>
        </g>

        <!-- 3. ARO LARANJA DO RELÓGIO -->
        <circle cx="215" cy="235" r="132" fill="#B83E04" filter="url(#drop_${uid})"/>
        <circle cx="215" cy="233" r="130" fill="url(#rim_${uid})"/>
        <circle cx="215" cy="233" r="122" fill="none" stroke="#FF9C54" stroke-width="2.5" opacity="0.65"/>

        <!-- 4. FACE DO RELÓGIO (3 OU 4 SESSÕES INTERATIVAS) -->
        <g filter="url(#inner_${uid})">
          ${slicesHtml}
        </g>
        <circle cx="215" cy="235" r="112" fill="none" stroke="#C9500C" stroke-width="3" pointer-events="none"/>

        <!-- Indicador numérico central -->
        <g pointer-events="none">
          <circle cx="215" cy="235" r="27" fill="#FFFDF9" stroke="#D97E38" stroke-width="2.5"/>
          <text x="215" y="241" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="17" fill="#6E472B">
            ${clockCurrent}/${clockMax}
          </text>
        </g>

        <!-- 5. PONTEIRO DIAMANTE NO TOPO (12H) -->
        <g filter="url(#drop_${uid})" pointer-events="none">
          <polygon points="215,92 197,115 215,142" fill="#FF852E"/>
          <polygon points="215,92 233,115 215,142" fill="#D9530B"/>
        </g>

        <!-- 6. VINHAS ENTRELAÇADAS E ESPINHOS AO REDOR DO RELÓGIO -->
        <g filter="url(#drop_${uid})" pointer-events="none">
          <path d="M104 316 C78 286 80 248 96 226 C112 204 76 176 96 146 C112 122 146 112 174 114 C186 115 190 105 180 101 C170 98 164 107 172 112"
                stroke="#4B6B10" stroke-width="6" stroke-linecap="round" fill="none"/>
          <path d="M104 316 C78 286 80 248 96 226 C112 204 76 176 96 146 C112 122 146 112 174 114"
                stroke="#76A31D" stroke-width="2.2" stroke-linecap="round" fill="none"/>

          <path d="M262 112 C304 116 346 146 344 190 C342 222 362 246 348 274 C334 300 352 332 324 352 C302 368 272 362 252 354"
                stroke="#4B6B10" stroke-width="6" stroke-linecap="round" fill="none"/>
          <path d="M262 112 C304 116 346 146 344 190 C342 222 362 246 348 274 C334 300 352 332 324 352"
                stroke="#76A31D" stroke-width="2.2" stroke-linecap="round" fill="none"/>

          <path d="M344 218 C364 218 370 238 356 244 C346 248 342 236 350 232"
                stroke="#4B6B10" stroke-width="4" stroke-linecap="round" fill="none"/>

          <path d="M142 350 C176 364 222 366 264 356"
                stroke="#4B6B10" stroke-width="5.5" stroke-linecap="round" fill="none"/>
          <path d="M142 350 C176 364 222 366 264 356"
                stroke="#76A31D" stroke-width="2" stroke-linecap="round" fill="none"/>

          <!-- Espinhos -->
          <path d="M84 268 L69 262 L85 256 Z" fill="#3B2510"/>
          <path d="M98 228 L112 224 L99 216 Z" fill="#3B2510"/>
          <path d="M86 178 L71 171 L88 166 Z" fill="#3B2510"/>
          <path d="M114 130 L106 115 L124 123 Z" fill="#3B2510"/>
          <path d="M148 115 L152 100 L160 114 Z" fill="#3B2510"/>
          <path d="M294 118 L302 104 L306 122 Z" fill="#3B2510"/>
          <path d="M336 154 L351 148 L341 164 Z" fill="#3B2510"/>
          <path d="M344 202 L329 206 L343 214 Z" fill="#3B2510"/>
          <path d="M353 266 L368 268 L350 278 Z" fill="#3B2510"/>
          <path d="M342 324 L357 328 L339 336 Z" fill="#3B2510"/>
          <path d="M174 360 L170 375 L184 362 Z" fill="#3B2510"/>
          <path d="M215 364 L215 379 L225 363 Z" fill="#3B2510"/>
          <path d="M254 358 L260 373 L264 356 Z" fill="#3B2510"/>
          <path d="M298 358 L305 372 L308 355 Z" fill="#3B2510"/>
        </g>

        <!-- 7. XÍCARA AZUL COM CHÁ TRANSBORDANDO -->
        <g transform="translate(115, 326)" filter="url(#drop_${uid})" pointer-events="none">
          <ellipse cx="0" cy="16" rx="29" ry="8" fill="#B8DCE6"/>
          <ellipse cx="0" cy="14" rx="26" ry="6" fill="#F2FAFC"/>
          <path d="M18 -6 C30 -8 32 8 17 8" stroke="#1893B3" stroke-width="5" stroke-linecap="round" fill="none"/>
          <path d="M-21 -10 C-21 12 21 12 21 -10 Z" fill="#22B2D4"/>
          <path d="M2 -10 C2 10 21 10 21 -10 Z" fill="#1794B3"/>
          <ellipse cx="0" cy="-10" rx="21" ry="5.5" fill="#F57622"/>
          <path d="M-16 -8 C-22 -4 -22 8 -19 15 C-17 19 -13 18 -14 13 C-15 7 -13 -2 -10 -6 Z" fill="#F57622"/>
        </g>

        <!-- 8. ROSAS SILVESTRES ENTRE OS ESPINHOS -->
        <g transform="translate(94, 152) scale(0.95)" filter="url(#drop_${uid})" pointer-events="none">
          <use href="#wildRose_${uid}"/>
        </g>
        <g transform="translate(314, 342) scale(1.12)" filter="url(#drop_${uid})" pointer-events="none">
          <use href="#wildRose_${uid}"/>
        </g>
        <g transform="translate(284, 358) rotate(24) scale(0.82)" filter="url(#drop_${uid})" pointer-events="none">
          <use href="#wildRose_${uid}"/>
        </g>
      </svg>
    `;
  }

  /**
   * Renderiza ou atualiza o modal completo no DOM.
   */
  render() {
    if (!this.isOpen) return;

    const actor = this.resolveTargetActor();
    const sheetData = extractFloralistSheetData(actor);
    const allFloralists = this.getAllFloralistActors();
    const isEditable = this.canControl(actor);

    const state = actor ? this.getGardenState(actor) : { ...DEFAULT_GARDEN_STATE };
    const plantedSeed = sheetData?.magiseeds.find((m) => m.fuid === state.plantedFuid) || null;
    const effectiveClockMax = plantedSeed ? plantedSeed.clockSections : state.clockMax;
    const activeStage = plantedSeed ? getActiveStageForClock(plantedSeed, state.clockCurrent) : null;

    let wrapper = document.getElementById("fu-floralist-hud");
    const isNew = !wrapper;

    if (isNew) {
      wrapper = document.createElement("div");
      wrapper.id = "fu-floralist-hud";
      wrapper.className = "fu-floralist-wrapper";
      if (this.isMinimized) wrapper.classList.add("is-minimized");
      document.body.appendChild(wrapper);
      this.element = wrapper;
    }

    const minimizedSummaryText = plantedSeed
      ? `${plantedSeed.name} • Relógio ${state.clockCurrent}/${effectiveClockMax}`
      : `Jardim Vazio • Relógio ${state.clockCurrent}/${effectiveClockMax}`;

    const actorSelectorHtml =
      allFloralists.length > 1
        ? `
          <select id="fuFloralActorSelect" class="fu-floral-select" title="Selecionar Floralista">
            ${allFloralists
              .map(
                (a) =>
                  `<option value="${a.id}" ${a.id === actor?.id ? "selected" : ""}>${a.name}</option>`
              )
              .join("")}
          </select>
        `
        : `<span class="fu-floral-actor-name">${sheetData?.actorName || "Sem Floralista"}</span>`;

    const bodyContentHtml = !sheetData
      ? `
        <div class="fu-floral-empty-world">
          <p>Nenhum personagem com a classe <strong>Floralista</strong> (<code>fuid: "floralist"</code>) foi encontrado neste mundo.</p>
        </div>
      `
      : `
        <!-- Barra Compacta de Status (visível ao minimizar) -->
        <div class="fu-floral-mini-status">
          <span class="fu-mini-dot ${plantedSeed ? "is-active" : ""}"></span>
          <span class="fu-mini-text">${minimizedSummaryText}</span>
          <span class="fu-mini-mp">PM ${sheetData.mpCurrent}/${sheetData.mpMax}</span>
        </div>

        <!-- Conteúdo Principal do Card -->
        <div class="fu-floral-content">
          <!-- Cabeçalho da Ficha e Controles de PM -->
          <div class="fu-floral-status-bar">
            <div class="fu-floral-actor-pill">
              <img src="${sheetData.actorImg}" alt="${sheetData.actorName}" />
              <div>
                ${actorSelectorHtml}
                <span class="fu-floral-level-badge">Nível ${sheetData.actorLevel}${
                  sheetData.actorLevel >= 30 ? " • Bônus Nv 30+ Ativo" : ""
                }</span>
              </div>
            </div>

            <div class="fu-floral-mp-box">
              <div class="fu-mp-counter">
                <i class="fas fa-sparkles"></i>
                <span>PM: <strong>${sheetData.mpCurrent}</strong> / ${sheetData.mpMax}</span>
              </div>
              <label class="fu-mp-checkbox" title="Descontar automaticamente 20 PM da ficha ao plantar via Cloromancia">
                <input type="checkbox" id="fuFloralDeductMp" ${state.deductMp ? "checked" : ""} ${
                  !isEditable ? "disabled" : ""
                } />
                <span>Descontar 20 PM</span>
              </label>
            </div>
          </div>

          ${
            !isEditable
              ? `<div class="fu-spectator-banner"><i class="fas fa-eye"></i> Modo Espectador (Somente Leitura)</div>`
              : ""
          }

          <!-- Seção do Relógio de Germinação -->
          <div class="fu-floral-clock-section">
            <div class="fu-clock-header-row">
              <span class="fu-section-title">Relógio de Germinação</span>
              <div class="fu-clock-variant-switch" role="group" aria-label="Variante do Relógio">
                <button type="button" class="fu-variant-btn ${effectiveClockMax === 4 ? "is-active" : ""}"
                        data-clock-max="4" ${!isEditable ? "disabled" : ""}>4 Sessões</button>
                <button type="button" class="fu-variant-btn ${effectiveClockMax === 3 ? "is-active" : ""}"
                        data-clock-max="3" ${!isEditable ? "disabled" : ""}>3 Sessões</button>
              </div>
            </div>

            <div class="fu-clock-stage-grid">
              <div class="fu-clock-svg-container">
                ${this._buildClockSvgHtml(state.clockCurrent, effectiveClockMax, isEditable)}
              </div>

              <div class="fu-clock-info-panel">
                ${
                  plantedSeed
                    ? `
                      <div class="fu-planted-card" data-hint-type="magiseed" data-hint-id="${plantedSeed.fuid}"
                           style="--seed-accent: ${plantedSeed.accent || "#4ade80"};"
                           title="Botão direito para ver todos os estágios">
                        <div class="fu-planted-top">
                          <img src="${plantedSeed.img}" alt="${plantedSeed.name}" />
                          <div class="fu-planted-meta">
                            <span class="fu-planted-tag">${plantedSeed.timing} • ${effectiveClockMax} Sessões</span>
                            <strong>${plantedSeed.name}</strong>
                          </div>
                        </div>
                        <div class="fu-planted-effect-box">
                          <div class="fu-stage-badge">${
                            activeStage ? activeStage.label : `Seção ${state.clockCurrent}`
                          }</div>
                          <p>${
                            activeStage
                              ? activeStage.summary
                              : "Aguardando avanço do Relógio de Germinação."
                          }</p>
                        </div>
                        <div class="fu-planted-actions">
                          <button type="button" id="fuPostEffectBtn" class="fu-btn fu-btn-soft" title="Enviar efeito atual ao chat">
                            <i class="fas fa-comment-dots"></i> Efeito
                          </button>
                          <button type="button" id="fuRemoveSeedBtn" class="fu-btn fu-btn-danger" ${
                            !isEditable ? "disabled" : ""
                          } title="Remover magissemente do jardim">
                            <i class="fas fa-trash-alt"></i> Remover
                          </button>
                        </div>
                      </div>
                    `
                    : `
                      <div class="fu-empty-garden-box">
                        <i class="fas fa-seedling"></i>
                        <strong>Jardim Vazio</strong>
                        <p>Escolha uma magissemente abaixo para plantar com <strong>Cloromancia</strong> (20 PM).</p>
                      </div>
                    `
                }
              </div>
            </div>

            <!-- Botões de Avanço de Turno -->
            <div class="fu-clock-controls-row">
              <button type="button" id="fuAdvanceTurnBtn" class="fu-btn fu-btn-primary" ${
                !isEditable || !plantedSeed ? "disabled" : ""
              }>
                <i class="fas fa-hourglass-half"></i> Fim do Turno (+1 Seção${
                  plantedSeed ? " & Ativar" : ""
                })
              </button>
              <button type="button" id="fuResetClockBtn" class="fu-btn fu-btn-ghost" ${
                !isEditable || state.clockCurrent === 0 ? "disabled" : ""
              } title="Zerar seções do relógio">
                <i class="fas fa-undo"></i> Zerar
              </button>
            </div>
          </div>

          <!-- Grid de Magissementes Descobertas (3 em cima, 2 centralizadas embaixo) -->
          <div class="fu-floral-seeds-section">
            <div class="fu-section-header-inline">
              <span class="fu-section-title">Magissementes Descobertas</span>
              <span class="fu-action-hint">
                ${
                  !plantedSeed
                    ? "Clique: Plantar • Dir.: Dica"
                    : state.clockCurrent >= 1 && sheetData.skills.graft
                      ? "Clique: Enxerto • Dir.: Dica"
                      : "Botão direito: Ver dica"
                }
              </span>
            </div>

            <div class="fu-seeds-grid">
              ${sheetData.magiseeds
                .map((seed) => {
                  const isPlanted = state.plantedFuid === seed.fuid;
                  const canGraft =
                    Boolean(plantedSeed) &&
                    !isPlanted &&
                    state.clockCurrent >= 1 &&
                    Boolean(sheetData.skills.graft);
                  const canPlant = !plantedSeed;
                  const disabled = !isEditable || (!canPlant && !canGraft);

                  let modeBadge = `${seed.clockSections} Sessões`;
                  if (isPlanted) modeBadge = "Enraizada";
                  else if (canPlant) modeBadge = `Plantar (${seed.clockSections}s)`;
                  else if (canGraft) modeBadge = `Enxertar (${seed.clockSections}s)`;

                  return `
                    <button type="button"
                            class="fu-seed-btn ${isPlanted ? "is-planted" : ""} ${canGraft ? "is-graftable" : ""}"
                            data-seed-fuid="${seed.fuid}"
                            data-hint-type="magiseed"
                            data-hint-id="${seed.fuid}"
                            ${disabled ? "disabled" : ""}
                            title="Botão direito para ver detalhes de ${seed.name}">
                      <img src="${seed.img}" alt="${seed.name}" />
                      <span class="fu-seed-name">${seed.name}</span>
                      <span class="fu-seed-badge">${modeBadge}</span>
                    </button>
                  `;
                })
                .join("")}
            </div>
          </div>

          <!-- Atalhos de Poderes de Floralista -->
          <div class="fu-floral-skills-bar">
            ${
              sheetData.skills.battleGardening
                ? `<button type="button" class="fu-skill-pill"
                           data-skill-post="battle-gardening"
                           data-hint-type="skill"
                           data-hint-id="battle-gardening"
                           title="Clique: Postar • Botão direito: Ver dica">
                    <img src="${sheetData.skills.battleGardening.item.img}" />
                    <span>Jardinagem Marcial (NP ${sheetData.skills.battleGardening.level})</span>
                  </button>`
                : ""
            }
            ${
              sheetData.skills.treeOfLife
                ? `<button type="button" class="fu-skill-pill"
                           data-skill-post="tree-of-life"
                           data-hint-type="skill"
                           data-hint-id="tree-of-life"
                           title="Clique: Postar • Botão direito: Ver dica">
                    <img src="${sheetData.skills.treeOfLife.item.img}" />
                    <span>Árvore da Vida (${sheetData.skills.treeOfLife.healAmount} PV)</span>
                  </button>`
                : ""
            }
            ${
              sheetData.skills.verdantSway
                ? `<button type="button" class="fu-skill-pill"
                           data-skill-post="verdant-sway"
                           data-hint-type="skill"
                           data-hint-id="verdant-sway"
                           title="Clique: Postar • Botão direito: Ver dica">
                    <img src="${sheetData.skills.verdantSway.item.img}" />
                    <span>Influência Verdejante</span>
                  </button>`
                : ""
            }
          </div>
        </div>
      `;

    wrapper.innerHTML = `
      <!-- Controles do Modal: Minimizar (_) e Fechar (X) acima de todas as flores -->
      <div class="fu-modal-controls">
        <button class="fu-modal-btn minimize-btn" id="fuFloralMinimizeBtn" type="button"
                title="${this.isMinimized ? "Expandir" : "Minimizar"}"
                aria-label="${this.isMinimized ? "Expandir" : "Minimizar"}">
          <svg id="fuFloralMinimizeIcon" viewBox="0 0 16 16">
            ${
              this.isMinimized
                ? '<line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />'
                : '<line x1="3" y1="11.5" x2="13" y2="11.5" />'
            }
          </svg>
        </button>
        <button class="fu-modal-btn close-btn" id="fuFloralCloseBtn" type="button" title="Fechar" aria-label="Fechar">
          <svg viewBox="0 0 16 16">
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="12" y1="4" x2="4" y2="12" />
          </svg>
        </button>
      </div>

      <!-- Base do Card com Centro Branco Limpo e Translúcido -->
      <div class="fu-card-body">
        <!-- Onda mint no topo interno (alça de arraste) -->
        <div class="fu-card-top-drag-zone" data-floral-drag-handle title="Arraste para mover • Duplo clique para minimizar">
          <svg class="fu-card-top-wave" viewBox="0 0 460 115" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0 H460 V48 C425 78, 370 72, 335 45 C295 75, 240 80, 195 55 C145 82, 70 84, 0 46 Z" fill="#CBE7D9" opacity="0.85"/>
            <path d="M310 52 C345 86, 405 92, 456 68" stroke="#CBE7D9" stroke-width="2" fill="none"/>
            <path d="M335 64 C372 95, 420 98, 456 80" stroke="#CBE7D9" stroke-width="1.5" fill="none"/>
            <g transform="translate(205, 82) scale(0.75)" opacity="0.35">
              <circle cx="0" cy="-11" r="8" fill="#BCE0CE"/>
              <circle cx="10.5" cy="-3.4" r="8" fill="#BCE0CE"/>
              <circle cx="6.5" cy="9" r="8" fill="#BCE0CE"/>
              <circle cx="-6.5" cy="9" r="8" fill="#BCE0CE"/>
              <circle cx="-10.5" cy="-3.4" r="8" fill="#BCE0CE"/>
              <circle cx="0" cy="0" r="5" fill="#FFFFFF"/>
            </g>
          </svg>
        </div>

        ${bodyContentHtml}

        <!-- Colinas de grama suaves no rodapé -->
        <svg class="fu-card-bottom-hills" viewBox="0 0 460 85" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 34 C95 22, 185 52, 285 44 C355 38, 415 24, 460 28 V85 H0 Z" fill="#D5ECE1"/>
          <path d="M0 54 C110 42, 210 68, 325 46 C385 34, 430 38, 460 44 V85 H0 Z" fill="#C4E3D4"/>
          <path d="M16 42 L13 33 L19 40 L20 31 L23 40 L27 34 L25 42 Z" fill="#C4E3D4"/>
          <path d="M214 55 L211 45 L217 53 L219 43 L222 53 L226 46 L224 55 Z" fill="#C4E3D4"/>
          <path d="M386 38 L384 28 L389 36 L392 26 L395 36 L399 29 L397 38 Z" fill="#C4E3D4"/>
        </svg>
      </div>

      <!-- Topo Ilustrado + Título Floralista (Sem as carinhas) -->
      <svg class="fu-floral-header-svg" viewBox="0 0 560 310" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="fuPinkPetal" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="#FCE4EC"/>
            <stop offset="65%" stop-color="#F7B2CE"/>
            <stop offset="100%" stop-color="#EB94B8"/>
          </radialGradient>
          <radialGradient id="fuOrangePetal" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="#FFD8A8"/>
            <stop offset="60%" stop-color="#FF9E44"/>
            <stop offset="100%" stop-color="#F07D22"/>
          </radialGradient>
          <radialGradient id="fuYellowPetal" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="#FFFDE7"/>
            <stop offset="65%" stop-color="#FDE373"/>
            <stop offset="100%" stop-color="#F5C842"/>
          </radialGradient>
          <radialGradient id="fuWhitePetal" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="#FFFFFF"/>
            <stop offset="75%" stop-color="#F7FBF9"/>
            <stop offset="100%" stop-color="#DCEEE4"/>
          </radialGradient>

          <linearGradient id="fuFloraGreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#7AB897"/>
            <stop offset="55%" stop-color="#5E9C7B"/>
            <stop offset="100%" stop-color="#4A8566"/>
          </linearGradient>
          <linearGradient id="fuListaOrangeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#FBC37A"/>
            <stop offset="55%" stop-color="#F49A4E"/>
            <stop offset="100%" stop-color="#E47E32"/>
          </linearGradient>

          <filter id="fuSoftDrop" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#3E6B53" flood-opacity="0.22"/>
          </filter>

          <g id="fuFlower5">
            <circle cx="0" cy="-13" r="10.5"/>
            <circle cx="12.4" cy="-4" r="10.5"/>
            <circle cx="7.6" cy="10.5" r="10.5"/>
            <circle cx="-7.6" cy="10.5" r="10.5"/>
            <circle cx="-12.4" cy="-4" r="10.5"/>
          </g>
        </defs>

        <!-- Brilhos amarelos -->
        <path d="M164 78 Q167 86 175 89 Q167 92 164 100 Q161 92 153 89 Q161 86 164 78 Z" fill="#FFF394" opacity="0.85"/>
        <path d="M388 64 Q390 71 397 73 Q390 75 388 82 Q386 75 379 73 Q386 71 388 64 Z" fill="#FFF394" opacity="0.85"/>
        <path d="M412 88 Q415 97 424 100 Q415 103 412 112 Q409 103 400 100 Q409 97 412 88 Z" fill="#FFF394" opacity="0.9"/>
        <circle cx="442" cy="96" r="5" fill="#FFF59D" opacity="0.75"/>

        <!-- Colinas/arbustos verdes atrás do título -->
        <g filter="url(#fuSoftDrop)">
          <path d="M242 128 C255 82, 315 74, 342 114 C362 104, 388 116, 395 138 L235 142 Z" fill="#5A9271"/>
          <path d="M175 136 C192 92, 255 86, 288 118 C312 114, 336 124, 348 144 L170 148 Z" fill="#6FAD80"/>
          <path d="M106 154 C112 114, 158 106, 185 134 L175 162 L106 162 Z" fill="#77B48E"/>
          <path d="M352 136 C375 110, 435 114, 452 154 L350 158 Z" fill="#82BC99"/>
        </g>

        <g filter="url(#fuSoftDrop)">
          <circle cx="198" cy="148" r="32" fill="#7AB394" stroke="#FFFFFF" stroke-width="3.5"/>
          <ellipse cx="305" cy="166" rx="26" ry="13" transform="rotate(-12 305 166)" fill="#F7B36B" stroke="#FFFFFF" stroke-width="3"/>
        </g>

        <!-- Vinhas e folhas laterais (Esquerda) -->
        <g filter="url(#fuSoftDrop)">
          <path d="M162 142 C115 138, 65 165, 62 215 C60 238, 72 252, 82 256" stroke="#538A6B" stroke-width="4.5" stroke-linecap="round" fill="none"/>
          <path d="M135 144 C112 158, 92 178, 72 184" stroke="#538A6B" stroke-width="3.5" stroke-linecap="round" fill="none"/>
          <path d="M118 134 C112 118, 128 112, 130 130 Z" fill="#5D9676"/>
          <path d="M84 152 C70 144, 66 160, 82 162 Z" fill="#6AA382"/>
          <path d="M148 158 C142 174, 158 178, 160 160 Z" fill="#5D9676"/>
          <path d="M178 175 C172 190, 188 192, 190 176 Z" fill="#538A6B"/>
          <path d="M62 232 C48 232, 50 246, 64 242 Z" fill="#6AA382"/>
          <path d="M68 250 C58 260, 70 268, 76 254 Z" fill="#5D9676"/>
        </g>

        <!-- Vinhas e folhas laterais (Direita) -->
        <g filter="url(#fuSoftDrop)">
          <path d="M398 144 C445 142, 492 166, 495 212 C497 232, 488 246, 480 252" stroke="#538A6B" stroke-width="4.5" stroke-linecap="round" fill="none"/>
          <path d="M448 182 C468 186, 474 206, 456 212 C444 215, 442 202, 452 198" stroke="#538A6B" stroke-width="3.5" stroke-linecap="round" fill="none"/>
          <path d="M412 132 C414 114, 430 118, 424 134 Z" fill="#5D9676"/>
          <path d="M432 160 C432 176, 448 176, 446 160 Z" fill="#5D9676"/>
          <path d="M402 168 C400 184, 416 186, 416 170 Z" fill="#6AA382"/>
          <path d="M494 234 C506 238, 502 252, 490 246 Z" fill="#7AB394"/>
        </g>

        <!-- Flores menores -->
        <g transform="translate(174, 124) scale(0.72)">
          <use href="#fuFlower5" fill="url(#fuOrangePetal)"/>
          <circle cx="0" cy="0" r="6" fill="#FFF9C4"/>
        </g>
        <g transform="translate(342, 128) scale(0.68)">
          <use href="#fuFlower5" fill="url(#fuPinkPetal)"/>
          <circle cx="0" cy="0" r="6" fill="#FFF9C4"/>
        </g>
        <g transform="translate(402, 124) scale(0.55)">
          <use href="#fuFlower5" fill="url(#fuOrangePetal)"/>
          <circle cx="0" cy="0" r="6" fill="#FFF9C4"/>
        </g>

        <!-- Flores grandes esquerda -->
        <g transform="translate(106, 134) scale(1.18)" filter="url(#fuSoftDrop)">
          <use href="#fuFlower5" fill="url(#fuPinkPetal)"/>
          <circle cx="0" cy="0" r="6.5" fill="#FFFDF7"/>
          <circle cx="0" cy="0" r="3.5" fill="#FDE068"/>
        </g>
        <g transform="translate(118, 172) rotate(15) scale(0.88)" filter="url(#fuSoftDrop)">
          <use href="#fuFlower5" fill="url(#fuWhitePetal)"/>
          <circle cx="0" cy="0" r="6" fill="#F9C74F"/>
        </g>
        <g transform="translate(68, 204) rotate(-14) scale(1.05)" filter="url(#fuSoftDrop)">
          <use href="#fuFlower5" fill="url(#fuOrangePetal)"/>
          <circle cx="0" cy="0" r="6" fill="#FFF8E1"/>
        </g>

        <!-- Flores grandes direita -->
        <g transform="translate(446, 132) rotate(12) scale(0.85)" filter="url(#fuSoftDrop)">
          <use href="#fuFlower5" fill="url(#fuWhitePetal)"/>
          <circle cx="0" cy="0" r="6" fill="#F7B2CE"/>
        </g>
        <g transform="translate(480, 162) rotate(18) scale(1.22)" filter="url(#fuSoftDrop)">
          <use href="#fuFlower5" fill="url(#fuYellowPetal)"/>
          <circle cx="0" cy="0" r="6.5" fill="#F9C74F"/>
        </g>
        <g transform="translate(426, 206) rotate(10) scale(1.12)" filter="url(#fuSoftDrop)">
          <use href="#fuFlower5" fill="url(#fuOrangePetal)"/>
          <circle cx="0" cy="0" r="6" fill="#FFF8E1"/>
        </g>

        <!-- Título "Floralista" (Área arrastável) -->
        <g transform="translate(280, 164)" text-anchor="middle" filter="url(#fuSoftDrop)"
           class="fu-title-drag-area" data-floral-drag-handle>
          <text x="0" y="0" class="fu-title-outer-stroke">Floralista</text>
          <text x="0" y="0">
            <tspan class="fu-title-mid-stroke-green">Flora</tspan><tspan class="fu-title-mid-stroke-orange">lista</tspan>
          </text>
          <text x="0" y="0" class="fu-title-fill">
            <tspan fill="url(#fuFloraGreenGrad)">Flora</tspan><tspan fill="url(#fuListaOrangeGrad)">lista</tspan>
          </text>
        </g>
      </svg>
    `;

    if (isNew) {
      this._applySavedPosition(wrapper);
    }

    this._bindDragEvents(wrapper);
    this._bindActionEvents(wrapper, sheetData, state, effectiveClockMax, isEditable);
  }

  _bindActionEvents(wrapper, sheetData, state, effectiveClockMax, isEditable) {
    // Minimizar e Fechar
    wrapper.querySelector("#fuFloralMinimizeBtn")?.addEventListener("click", () => {
      this.toggleMinimize();
    });
    wrapper.querySelector("#fuFloralCloseBtn")?.addEventListener("click", () => {
      this.close();
    });

    if (!sheetData) return;

    const actor = sheetData.actor;

    // Botão direito (Context Menu) para Hint nas Magissementes e Habilidades
    wrapper.querySelectorAll("[data-hint-type]").forEach((el) => {
      el.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.showHintPopover(ev.clientX, ev.clientY, sheetData, {
          type: el.dataset.hintType,
          id: el.dataset.hintId
        });
      });
    });

    // Trocar ator caso haja mais de um Floralista no mundo
    wrapper.querySelector("#fuFloralActorSelect")?.addEventListener("change", (ev) => {
      this.selectedActorId = ev.target.value;
      this.render();
    });

    // Checkbox de desconto automático de 20 PM
    wrapper.querySelector("#fuFloralDeductMp")?.addEventListener("change", async (ev) => {
      if (!isEditable) return;
      await this.saveGardenState(actor, { deductMp: ev.target.checked });
    });

    // Alternar variante do relógio (3 ou 4 sessões)
    wrapper.querySelectorAll("[data-clock-max]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!isEditable) return;
        const nextMax = Number(btn.dataset.clockMax);
        if (state.plantedFuid) {
          await this.setSeedClockSections(sheetData, state.plantedFuid, nextMax);
        } else {
          const clampedCurrent = Math.min(state.clockCurrent, nextMax - 1);
          await this.saveGardenState(actor, {
            clockMax: nextMax,
            clockCurrent: clampedCurrent
          });
        }
      });
    });

    // Clique direto nas fatias do SVG do Relógio
    wrapper.querySelectorAll("[data-clock-slice]").forEach((slice) => {
      slice.addEventListener("click", async () => {
        if (!isEditable) return;
        const clickedIndex = Number(slice.dataset.clockSlice);
        const nextVal = state.clockCurrent === clickedIndex ? clickedIndex - 1 : clickedIndex;
        if (nextVal >= effectiveClockMax && state.plantedFuid) {
          await this._handleClockCompleted(sheetData, state, effectiveClockMax);
        } else {
          await this.saveGardenState(actor, { clockCurrent: Math.max(0, nextVal) });
        }
      });
    });

    // Botão: Fim do Turno (+1 Seção & Ativar Efeito)
    wrapper.querySelector("#fuAdvanceTurnBtn")?.addEventListener("click", async () => {
      if (!isEditable || !state.plantedFuid) return;
      await this._advanceEndOfTurn(sheetData, state, effectiveClockMax);
    });

    // Botão: Zerar Relógio
    wrapper.querySelector("#fuResetClockBtn")?.addEventListener("click", async () => {
      if (!isEditable) return;
      await this.saveGardenState(actor, { clockCurrent: 0 });
    });

    // Botão: Postar efeito atual no chat sem avançar o relógio
    wrapper.querySelector("#fuPostEffectBtn")?.addEventListener("click", async () => {
      const seed = sheetData.magiseeds.find((m) => m.fuid === state.plantedFuid);
      if (!seed) return;
      await this._postMagiseedStageToChat(sheetData, seed, state.clockCurrent, effectiveClockMax, false);
    });

    // Botão: Remover magissemente manualmente
    wrapper.querySelector("#fuRemoveSeedBtn")?.addEventListener("click", async () => {
      if (!isEditable || !state.plantedFuid) return;
      const seed = sheetData.magiseeds.find((m) => m.fuid === state.plantedFuid);
      await this.saveGardenState(actor, {
        plantedFuid: null,
        plantedItemId: null,
        clockCurrent: 0
      });
      if (seed) {
        await this._postSeedRemovedChat(sheetData, seed, "Magissemente removida do jardim.");
      }
    });

    // Clique esquerdo nas Magissementes (Cloromancia ou Enxerto)
    wrapper.querySelectorAll("[data-seed-fuid]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!isEditable) return;
        const targetFuid = btn.dataset.seedFuid;
        const targetSeed = sheetData.magiseeds.find((m) => m.fuid === targetFuid);
        if (!targetSeed) return;

        if (!state.plantedFuid) {
          await this._plantWithChloromancy(sheetData, state, targetSeed);
        } else if (
          state.plantedFuid !== targetFuid &&
          state.clockCurrent >= 1 &&
          sheetData.skills.graft
        ) {
          await this._swapWithGraft(sheetData, state, targetSeed);
        }
      });
    });

    // Botões rápidos de perícias no rodapé
    wrapper.querySelectorAll("[data-skill-post]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const skillKey = btn.dataset.skillPost;
        await this._postSkillCardToChat(sheetData, skillKey);
      });
    });
  }

  /**
   * Planta uma magissemente via Cloromancia (20 PM, Relógio = 0, ajusta automaticamente para 3 ou 4 sessões).
   */
  async _plantWithChloromancy(sheetData, state, seed) {
    const actor = sheetData.actor;
    const mpCost = 20;
    const targetClockMax = seed.clockSections || 4;

    if (state.deductMp) {
      const currentMp = Number(actor.system?.resources?.mp?.value ?? 0);
      if (currentMp < mpCost) {
        ui.notifications?.warn(
          `${actor.name} possui apenas ${currentMp} PM (Cloromancia requer ${mpCost} PM).`
        );
        return;
      }
      await actor.update({ "system.resources.mp.value": currentMp - mpCost });
    }

    await this.saveGardenState(actor, {
      plantedFuid: seed.fuid,
      plantedItemId: seed.itemId,
      clockCurrent: 0,
      clockMax: targetClockMax
    });

    const stageZero = getActiveStageForClock(seed, 0);
    const passiveHtml = stageZero
      ? `<hr />${stageZero.buildChatHtml(sheetData.formulas)}`
      : "";

    let martialButtonsHtml = "";
    const bg = sheetData.skills.battleGardening;
    const gc = sheetData.skills.greaterChloromancy;

    if (bg) {
      martialButtonsHtml += `
        <div style="font-size: 0.85em; font-weight: 700; color: #3b5946; margin-top: 2px;">
          Jardinagem Marcial (NP ${bg.level} • RA = 0 no dano):
        </div>
        <button type="button" class="fu-chat-action-btn" data-fu-floral-action="free-attack" data-actor-id="${actor.id}">
          ⚔️ Ataque Livre com Arma Equipada
        </button>
        <button type="button" class="fu-chat-action-btn" data-fu-floral-action="free-spell" data-actor-id="${actor.id}">
          ✨ Feitiço Grátis (Custo ≤ ${bg.maxSpellMp} PM)
        </button>
      `;

      if (gc) {
        martialButtonsHtml += `
          <button type="button" class="fu-chat-action-btn" data-fu-floral-action="free-study" data-actor-id="${actor.id}">
            🔍 Cloromancia Maior: Estudar Grátis (+${gc.studyBonus})
          </button>
          <button type="button" class="fu-chat-action-btn" data-fu-floral-action="free-inventory" data-actor-id="${actor.id}">
            🎒 Cloromancia Maior: Criar Remédio / Elixir / Tônico
          </button>
        `;
      }
    }

    const content = buildProjectFuChatCard({
      icon: seed.img,
      title: `Cloromancia: ${seed.name}`,
      subtitle: `${actor.name} • Jardim (0/${targetClockMax} seções)`,
      tags: [
        "Floralista",
        "Cloromancia",
        state.deductMp ? "20 PM gastos" : "20 PM",
        seed.timing
      ],
      descriptionHtml: `
        <p><strong>${actor.name}</strong> planta <strong>${seed.name}</strong> em seu jardim. O Relógio de Germinação começa em <strong>0/${targetClockMax}</strong>.</p>
        ${passiveHtml}
      `,
      footerButtonsHtml: martialButtonsHtml
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content
    });
  }

  /**
   * Substitui a magissemente atual via Enxerto (0 PM, ajusta o relógio de 3/4 sessões mantendo as seções).
   */
  async _swapWithGraft(sheetData, state, newSeed) {
    const actor = sheetData.actor;
    const oldSeed = sheetData.magiseeds.find((m) => m.fuid === state.plantedFuid);
    const targetClockMax = newSeed.clockSections || 4;

    if (state.clockCurrent >= targetClockMax) {
      await this.saveGardenState(actor, {
        plantedFuid: null,
        plantedItemId: null,
        clockCurrent: 0,
        clockMax: targetClockMax
      });
      await this._postSeedRemovedChat(
        sheetData,
        newSeed,
        `<strong>${actor.name}</strong> enxertou <strong>${newSeed.name}</strong> (ciclo de ${targetClockMax} seções) com <strong>${state.clockCurrent}</strong> seções preenchidas, completando imediatamente o ciclo e removendo a magissemente!`
      );
      return;
    }

    await this.saveGardenState(actor, {
      plantedFuid: newSeed.fuid,
      plantedItemId: newSeed.itemId,
      clockMax: targetClockMax
    });

    const activeStage = getActiveStageForClock(newSeed, state.clockCurrent);
    const stageHtml = activeStage
      ? `<hr />${activeStage.buildChatHtml(sheetData.formulas)}`
      : "";

    const treeOfLifeBtn = sheetData.skills.treeOfLife
      ? `
        <button type="button" class="fu-chat-action-btn" data-fu-floral-action="tree-of-life" data-actor-id="${actor.id}">
          🌳 Árvore da Vida: Curar Alvo em Crise (${sheetData.skills.treeOfLife.healAmount} PV)
        </button>
      `
      : "";

    const content = buildProjectFuChatCard({
      icon: sheetData.skills.graft?.item?.img || newSeed.img,
      title: `Enxerto: ${newSeed.name}`,
      subtitle: `${actor.name} • Mantém ${state.clockCurrent}/${targetClockMax} seções`,
      tags: [
        "Floralista",
        "Enxerto",
        "0 PM",
        `Relógio ${state.clockCurrent}/${targetClockMax}`
      ],
      descriptionHtml: `
        <p><strong>${actor.name}</strong> remove <strong>${oldSeed?.name || "a magissemente anterior"}</strong> do jardim e imediatamente enxerta <strong>${newSeed.name}</strong>, mantendo <strong>${state.clockCurrent}/${targetClockMax}</strong> seções preenchidas no Relógio de Germinação.</p>
        ${stageHtml}
      `,
      footerButtonsHtml: treeOfLifeBtn
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content
    });
  }

  /**
   * Avança 1 seção no fim do turno e dispara o efeito correspondente ou remove ao completar o relógio.
   */
  async _advanceEndOfTurn(sheetData, state, effectiveClockMax) {
    const actor = sheetData.actor;
    const seed = sheetData.magiseeds.find((m) => m.fuid === state.plantedFuid);
    if (!seed) return;

    const nextClock = state.clockCurrent + 1;

    if (nextClock >= effectiveClockMax) {
      await this._handleClockCompleted(sheetData, state, effectiveClockMax);
      return;
    }

    await this.saveGardenState(actor, { clockCurrent: nextClock });
    await this._postMagiseedStageToChat(sheetData, seed, nextClock, effectiveClockMax, true);
  }

  /**
   * Ao preencher a última seção (4/4 ou 3/3): remove a magissemente e apaga todas as seções.
   */
  async _handleClockCompleted(sheetData, state, effectiveClockMax) {
    const actor = sheetData.actor;
    const seed = sheetData.magiseeds.find((m) => m.fuid === state.plantedFuid);

    await this.saveGardenState(actor, {
      plantedFuid: null,
      plantedItemId: null,
      clockCurrent: 0
    });

    if (seed) {
      await this._postSeedRemovedChat(
        sheetData,
        seed,
        `O Relógio de Germinação atingiu <strong>${effectiveClockMax}/${effectiveClockMax}</strong> seções! <strong>${seed.name}</strong> encerrou seu ciclo, foi removida do jardim e todas as seções do relógio foram apagadas.`
      );
    }
  }

  async _postMagiseedStageToChat(sheetData, seed, clockCount, clockMax, isEndOfTurn) {
    const actor = sheetData.actor;
    const stage = getActiveStageForClock(seed, clockCount);

    const bodyHtml = stage
      ? stage.buildChatHtml(sheetData.formulas)
      : `<p>O Relógio de Germinação está em <strong>${clockCount}/${clockMax}</strong> seções. Nenhum efeito ativo nesta seção.</p>`;

    const content = buildProjectFuChatCard({
      icon: seed.img,
      title: `${seed.name} (${clockCount}/${clockMax})`,
      subtitle: `${actor.name} • ${isEndOfTurn ? "Fim do Turno" : "Efeito do Jardim"}`,
      tags: [
        "Magissemente",
        seed.timing,
        `Relógio ${clockCount}/${clockMax}`,
        ...(sheetData.actorLevel >= 30 ? ["Nv 30+"] : [])
      ],
      descriptionHtml: bodyHtml
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content
    });
  }

  async _postSeedRemovedChat(sheetData, seed, reasonHtml) {
    const actor = sheetData.actor;
    const tol = sheetData.skills.treeOfLife;

    const treeBtnHtml = tol
      ? `
        <button type="button" class="fu-chat-action-btn" data-fu-floral-action="tree-of-life" data-actor-id="${actor.id}">
          🌳 Árvore da Vida: Curar Alvo em Crise (${tol.healAmount} PV)
        </button>
      `
      : "";

    const content = buildProjectFuChatCard({
      icon: seed.img,
      title: `Jardim Esvaziado: ${seed.name}`,
      subtitle: `${actor.name} • Relógio Reiniciado (0/${this.getGardenState(actor).clockMax})`,
      tags: ["Floralista", "Jardim", "Magissemente Removida"],
      descriptionHtml: `<p>${reasonHtml}</p>`,
      footerButtonsHtml: treeBtnHtml
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content
    });
  }

  async _postSkillCardToChat(sheetData, skillKey) {
    const actor = sheetData.actor;

    if (skillKey === "tree-of-life" && sheetData.skills.treeOfLife) {
      const tol = sheetData.skills.treeOfLife;
      const content = buildProjectFuChatCard({
        icon: tol.item.img,
        title: `Árvore da Vida (NP ${tol.level})`,
        subtitle: actor.name,
        tags: ["Floralista", "Reação ao Remover Magissemente"],
        descriptionHtml: `
          <p>Ao remover uma magissemente de seu jardim, você pode escolher uma criatura que você possa ver: se o alvo estiver em <strong>Crise</strong>, ele recupera <strong>【5 + (NP ${tol.level} × 5)】</strong> PV.</p>
          <hr />
          <ul>
            <li><strong>O Alvo Recupera:</strong> @GAIN[${tol.healAmount} hp]{${tol.healAmount} PV}</li>
          </ul>
        `
      });
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
      return;
    }

    if (skillKey === "battle-gardening" && sheetData.skills.battleGardening) {
      const bg = sheetData.skills.battleGardening;
      const gc = sheetData.skills.greaterChloromancy;
      const content = buildProjectFuChatCard({
        icon: bg.item.img,
        title: `Jardinagem Marcial (NP ${bg.level})`,
        subtitle: actor.name,
        tags: ["Floralista", "Após Cloromancia", "RA = 0 no Dano"],
        descriptionHtml: `
          <p>Após plantar uma magissemente usando <strong>Cloromancia</strong> (não Enxerto), você pode escolher:</p>
          <ul>
            <li>Fazer um <strong>ataque livre</strong> com uma arma equipada; <em>ou</em></li>
            <li>Realizar a ação <strong>Feitiço</strong> de graça, conjurando um feitiço com custo total de PM igual ou inferior a <strong>${bg.maxSpellMp} PM</strong> (pagando seu custo normal em PM).</li>
            ${
              gc
                ? `<li><strong>Cloromancia Maior:</strong> Alternativamente, realize a ação <strong>Estudar</strong> gratuitamente com bônus de <strong>+${gc.studyBonus}</strong>, ou a ação <strong>Inventário</strong> gratuitamente para criar um <strong>Remédio</strong>, <strong>Elixir</strong> ou <strong>Tônico</strong>.</li>`
                : ""
            }
          </ul>
          <p><em>Trate a Rolagem Alta (RA) do Teste de Precisão ou Teste de Magia como igual a 0 ao determinar o dano.</em></p>
        `
      });
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
      return;
    }

    if (skillKey === "verdant-sway" && sheetData.skills.verdantSway) {
      const vs = sheetData.skills.verdantSway;
      const content = buildProjectFuChatCard({
        icon: vs.item.img,
        title: "Influência Verdejante",
        subtitle: actor.name,
        tags: ["Floralista", "Ritualismo"],
        descriptionHtml: `
          <p>Você pode realizar Rituais da disciplina de <strong>Ritualismo</strong>. Além disso, pode usar Ritualismo para <strong>criar, animar e/ou controlar vegetação, pólen, esporos e toxinas</strong> (mas não pode criar nem controlar PNJs da espécie planta dessa forma).</p>
        `
      });
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
    }
  }
}
