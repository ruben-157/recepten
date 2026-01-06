const contentInner = document.getElementById("contentInner");
const recipeList = document.getElementById("recipeList");
const searchInput = document.getElementById("searchInput");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarClose = document.getElementById("sidebarClose");

const cache = new Map();
const servingsState = new Map();
let recipes = [];
let activeId = null;

const md = window.markdownit({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (!window.hljs) {
      return str;
    }
    if (lang && window.hljs.getLanguage(lang)) {
      return window.hljs.highlight(str, { language: lang }).value;
    }
    return window.hljs.highlightAuto(str).value;
  }
});

md.use(window.markdownitFootnote);
md.use(window.markdownitTaskLists, { enabled: true });
const anchorPlugin = window.markdownItAnchor || window.markdownitAnchor;
if (anchorPlugin && anchorPlugin.permalink) {
  md.use(anchorPlugin, {
    permalink: anchorPlugin.permalink.linkInsideHeader({
      symbol: "#",
      placement: "after",
      class: "anchor"
    })
  });
}

function setContent(html) {
  contentInner.innerHTML = html;
}

function setError(message, showBackLink = false) {
  const backLink = showBackLink && recipes[0]
    ? `<p><a href="#/recept/${recipes[0].id}">Terug naar ${recipes[0].title}</a></p>`
    : "";
  setContent(`
    <div class="error-box">
      <h2>Oeps</h2>
      <p>${message}</p>
      ${backLink}
    </div>
  `);
}

function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { meta: {}, body: markdown };
  }
  const meta = {};
  match[1].split("\n").forEach((line) => {
    const separator = line.indexOf(":");
    if (separator === -1) {
      return;
    }
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key) {
      meta[key] = value;
    }
  });
  return { meta, body: markdown.slice(match[0].length) };
}

function parseNumber(value) {
  if (!value) {
    return null;
  }
  const normalized = value.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatQuantity(value) {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return String(Math.round(rounded));
  }
  return rounded.toString().replace(".", ",");
}

function parseBoolean(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["false", "no", "nee", "0", "off"].includes(normalized)) {
    return false;
  }
  if (["true", "yes", "ja", "1", "on"].includes(normalized)) {
    return true;
  }
  return null;
}

function getServings(meta) {
  const raw = meta.porties || meta.servings;
  if (!raw) {
    return null;
  }
  const match = raw.match(/(\d+(?:[.,]\d+)?)/);
  return match ? parseNumber(match[1]) : null;
}

function getServingsEnabled(meta) {
  const raw = meta.porties_aanpasbaar || meta.servings_adjustable || meta["servings-adjustable"];
  const parsed = parseBoolean(raw);
  return parsed !== null ? parsed : true;
}

function findIngredientLists(article) {
  const lists = [];
  article.querySelectorAll("h2, h3").forEach((heading) => {
    const clone = heading.cloneNode(true);
    const anchor = clone.querySelector(".anchor");
    if (anchor) {
      anchor.remove();
    }
    const text = clone.textContent.trim().toLowerCase();
    if (text === "ingredienten" || text === "ingrediënten") {
      let sibling = heading.nextElementSibling;
      while (sibling && !/^H[1-6]$/.test(sibling.tagName)) {
        if (sibling.tagName === "UL" || sibling.tagName === "OL") {
          lists.push(sibling);
        }
        sibling = sibling.nextElementSibling;
      }
    }
  });
  return lists;
}

function annotateIngredientList(list) {
  list.querySelectorAll("li").forEach((li) => {
    if (li.querySelector("span[data-qty]")) {
      return;
    }
    if (li.childNodes.length !== 1 || li.childNodes[0].nodeType !== Node.TEXT_NODE) {
      return;
    }
    const text = li.textContent.trim();
    const match = text.match(/^(\D*?)(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s+(.*)$/);
    if (!match) {
      return;
    }
    const prefix = match[1] || "";
    const qty = parseNumber(match[2]);
    const qtyMax = parseNumber(match[3]);
    if (qty === null) {
      return;
    }
    const rest = match[4] || "";
    const qtyText = qtyMax ? `${match[2]}-${match[3]}` : match[2];
    const prefixText = prefix ? `${prefix}` : "";
    const spacer = prefixText && !prefixText.endsWith(" ") ? " " : "";
    const qtyMaxAttr = qtyMax !== null ? ` data-qty-max="${qtyMax}"` : "";
    li.innerHTML = `${prefixText}${spacer}<span class="qty" data-qty="${qty}"${qtyMaxAttr}>${qtyText}</span> ${rest}`;
  });
}

function applyServingsScale(article, baseServings, currentServings) {
  if (!baseServings || !currentServings) {
    return;
  }
  const factor = currentServings / baseServings;
  const lists = findIngredientLists(article);
  lists.forEach((list) => {
    annotateIngredientList(list);
    list.querySelectorAll("span[data-qty]").forEach((span) => {
      const baseQty = parseNumber(span.dataset.qty);
      if (baseQty === null) {
        return;
      }
      const baseMax = parseNumber(span.dataset.qtyMax);
      const scaled = formatQuantity(baseQty * factor);
      if (baseMax !== null) {
        const scaledMax = formatQuantity(baseMax * factor);
        span.textContent = `${scaled}-${scaledMax}`;
      } else {
        span.textContent = scaled;
      }
    });
  });
}

function getIdFromHash() {
  const match = window.location.hash.match(/^#\/recept\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function renderMenu(items) {
  recipeList.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#/recept/${item.id}`;
    link.dataset.id = item.id;
    link.innerHTML = `${item.title}<span class="file">${item.file}</span>`;
    if (item.id === activeId) {
      link.classList.add("active");
    }
    li.appendChild(link);
    recipeList.appendChild(li);
  });
}

function updateActiveState() {
  recipeList.querySelectorAll("a").forEach((link) => {
    link.classList.toggle("active", link.dataset.id === activeId);
  });
}

function applyFilter() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = recipes.filter((item) => {
    return item.title.toLowerCase().includes(query) || item.id.toLowerCase().includes(query);
  });
  renderMenu(filtered);
}

function renderRecipe(id) {
  const recipe = recipes.find((item) => item.id === id);
  if (!recipe) {
    setError("Dit recept bestaat niet.", true);
    return;
  }

  activeId = id;
  updateActiveState();

  const cached = cache.get(id);
  const baseServings = recipe.servings;
  const servingsEnabled = recipe.servingsEnabled;
  const showServings = baseServings && servingsEnabled;
  const currentServings = servingsState.get(id) || baseServings;
  if (cached) {
    const header = showServings
      ? `
        <div class="recipe-meta">
          <div class="servings-control">
            <span class="label">Porties</span>
            <button type="button" data-action="dec" aria-label="Minder porties">-</button>
            <input type="number" min="1" step="1" value="${currentServings}" />
            <button type="button" data-action="inc" aria-label="Meer porties">+</button>
            <span class="base">Basis: ${baseServings}</span>
          </div>
        </div>
      `
      : "";
    setContent(`${header}<article class="markdown-body">${md.render(cached.body)}</article>`);
    const article = contentInner.querySelector(".markdown-body");
    if (article && showServings) {
      applyServingsScale(article, baseServings, currentServings);
      const control = contentInner.querySelector(".servings-control");
      const input = control.querySelector("input");
      control.addEventListener("click", (event) => {
        if (!(event.target instanceof HTMLElement)) {
          return;
        }
        const action = event.target.dataset.action;
        if (!action) {
          return;
        }
        const next = Math.max(1, Number.parseInt(input.value, 10) + (action === "inc" ? 1 : -1));
        input.value = String(next);
        servingsState.set(id, next);
        applyServingsScale(article, baseServings, next);
      });
      input.addEventListener("input", () => {
        const value = Math.max(1, Number.parseInt(input.value || "1", 10));
        input.value = String(value);
        servingsState.set(id, value);
        applyServingsScale(article, baseServings, value);
      });
    }
    closeSidebarOnMobile();
    return;
  }

  setContent("<p class=\"muted\">Laden...</p>");
  fetch(`recepten/${recipe.file}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Recept niet gevonden");
      }
      return response.text();
    })
    .then((text) => {
      const parsed = parseFrontmatter(text);
      cache.set(id, parsed);
      const header = showServings
        ? `
          <div class="recipe-meta">
            <div class="servings-control">
              <span class="label">Porties</span>
              <button type="button" data-action="dec" aria-label="Minder porties">-</button>
              <input type="number" min="1" step="1" value="${currentServings}" />
              <button type="button" data-action="inc" aria-label="Meer porties">+</button>
              <span class="base">Basis: ${baseServings}</span>
            </div>
          </div>
        `
        : "";
      setContent(`${header}<article class="markdown-body">${md.render(parsed.body)}</article>`);
      const article = contentInner.querySelector(".markdown-body");
      if (article && showServings) {
        applyServingsScale(article, baseServings, currentServings);
        const control = contentInner.querySelector(".servings-control");
        const input = control.querySelector("input");
        control.addEventListener("click", (event) => {
          if (!(event.target instanceof HTMLElement)) {
            return;
          }
          const action = event.target.dataset.action;
          if (!action) {
            return;
          }
          const next = Math.max(1, Number.parseInt(input.value, 10) + (action === "inc" ? 1 : -1));
          input.value = String(next);
          servingsState.set(id, next);
          applyServingsScale(article, baseServings, next);
        });
        input.addEventListener("input", () => {
          const value = Math.max(1, Number.parseInt(input.value || "1", 10));
          input.value = String(value);
          servingsState.set(id, value);
          applyServingsScale(article, baseServings, value);
        });
      }
      closeSidebarOnMobile();
    })
    .catch(() => {
      setError("Kon het recept niet laden. Controleer of het bestand bestaat.");
    });
}

function handleRoute() {
  const id = getIdFromHash();
  if (!id) {
    if (recipes[0]) {
      window.location.hash = `#/recept/${recipes[0].id}`;
    }
    return;
  }
  renderRecipe(id);
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 960) {
    sidebar.classList.remove("open");
    sidebarToggle.setAttribute("aria-expanded", "false");
  }
}

sidebarToggle.addEventListener("click", () => {
  const isOpen = sidebar.classList.toggle("open");
  sidebarToggle.setAttribute("aria-expanded", String(isOpen));
});

if (sidebarClose) {
  sidebarClose.addEventListener("click", () => {
    sidebar.classList.remove("open");
    sidebarToggle.setAttribute("aria-expanded", "false");
  });
}

searchInput.addEventListener("input", applyFilter);
window.addEventListener("hashchange", handleRoute);

fetch("recepten/index.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error("index.json ontbreekt");
    }
    return response.json();
  })
  .then((data) => {
    if (!data.files || !Array.isArray(data.files)) {
      throw new Error("index.json heeft geen files lijst");
    }
    return Promise.all(
      data.files.map((file) =>
        fetch(`recepten/${file}`)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Kan ${file} niet laden`);
            }
            return response.text();
          })
          .then((text) => {
            const parsed = parseFrontmatter(text);
            const id = file.replace(/\.md$/i, "");
            const title = extractTitle(parsed.body, id);
            const servings = getServings(parsed.meta);
            const servingsEnabled = getServingsEnabled(parsed.meta);
            cache.set(id, parsed);
            return { id, title, file, servings, servingsEnabled };
          })
      )
    );
  })
  .then((items) => {
    recipes = items;
    renderMenu(recipes);
    applyFilter();
    handleRoute();
  })
  .catch((error) => {
    console.error(error);
    setError("Kon recepten/index.json niet laden. Draai een simpele static server of controleer het pad.");
  });
