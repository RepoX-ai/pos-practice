/* =====================================================================
   POS Practice - app.js
   ---------------------------------------------------------------------
   All the logic for the little Point-of-Sale page lives in this file.

   Big picture:
     1. There are five lists of data:
          products     = the things we sell (name, price, category)
          stock        = how many of each product we have + a low-stock threshold
          stockHistory = every change to stock (sales, restocks, adjustments)
          cart         = what the customer is buying right now
          sales        = every completed sale
     2. All five are saved in localStorage, so they survive a page refresh
        (but only in THIS browser).
     3. Every time something changes we save everything and then re-draw
        ("render") the page from the data.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. SAMPLE DATA
   The sample products are used only the first time the page opens (or
   after localStorage is cleared). After that the products live in
   localStorage, and new ones are added through the Inventory form.
   --------------------------------------------------------------------- */
const SAMPLE_PRODUCTS = [
  { id: 1, name: "Kopi Hitam",    price: 15000, category: "Drinks" },
  { id: 2, name: "Es Teh Manis",  price: 8000,  category: "Drinks" },
  { id: 3, name: "Cappuccino",    price: 25000, category: "Drinks" },
  { id: 4, name: "Roti Bakar",    price: 18000, category: "Food"   },
  { id: 5, name: "Nasi Goreng",   price: 30000, category: "Food"   },
  { id: 6, name: "Pisang Goreng", price: 12000, category: "Snacks" },
];

const SAMPLE_STOCK_QTY = 20;   // starting stock for a product that has no stock record yet
const SAMPLE_THRESHOLD = 5;    // warn when stock is at or below this number

/* ---------------------------------------------------------------------
   2. localStorage HELPERS
   localStorage can only store text, so we turn our data into JSON text
   when saving, and back into arrays/objects when loading.
   Each kind of data has its own key (its own "drawer" in localStorage).
   --------------------------------------------------------------------- */
const PRODUCTS_KEY      = "pos-practice-products";
const STOCK_KEY         = "pos-practice-stock";
const STOCK_HISTORY_KEY = "pos-practice-stock-history";
const CART_KEY          = "pos-practice-cart";
const SALES_KEY         = "pos-practice-sales";

// fallback = what to return when nothing is saved yet (an [] or a {})
function loadFromStorage(key, fallback) {
  try {
    const text = localStorage.getItem(key);   // null if nothing saved yet
    return text ? JSON.parse(text) : fallback;
  } catch (error) {
    return fallback;                          // saved text was broken -> start fresh
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---------------------------------------------------------------------
   3. STATE (the data that changes while the app runs)

   products     = list of { id, name, price, category }
   stock        = object keyed by product id:
                    { "1": { qty: 20, threshold: 5 }, "2": { ... }, ... }
   stockHistory = list of { date, productId, productName, type, change, resulting }
   cart         = list of { productId, qty }
   sales        = list of { date, items: [{ productId, name, price, qty }], total }
   --------------------------------------------------------------------- */
let products     = loadFromStorage(PRODUCTS_KEY, []);
let stock        = loadFromStorage(STOCK_KEY, {});
let stockHistory = loadFromStorage(STOCK_HISTORY_KEY, []);
let cart         = loadFromStorage(CART_KEY, []);
let sales        = loadFromStorage(SALES_KEY, []);

// First visit: start with the sample products (slice() makes a copy)
if (products.length === 0) {
  products = SAMPLE_PRODUCTS.slice();
}

// Safety: drop cart lines whose product no longer exists.
// (findProduct is defined a bit further down; that is fine in JavaScript.)
cart = cart.filter((line) => findProduct(line.productId) !== undefined);

// Safety: make sure every product has a stock record (see getStock below)
for (const product of products) {
  getStock(product.id);
}

/* ---------------------------------------------------------------------
   4. SMALL UTILITIES
   --------------------------------------------------------------------- */

// Turn 25000 into the text "Rp 25.000".
// "id-ID" tells the browser to use Indonesian formatting, which uses
// dots as thousand separators.
function formatRupiah(amount) {
  return "Rp " + amount.toLocaleString("id-ID");
}

// Turn "2026-10-26T08:30:00.000Z" into something like "26 Okt 2026, 15.30"
function formatDate(isoText) {
  return new Date(isoText).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Make user-typed text safe to put inside innerHTML.
// Without this, a product named "<b>Hi</b>" would be treated as HTML.
// (Only for text between tags, not for text inside attributes.)
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Find a product object by its id, e.g. findProduct(3) -> Cappuccino
function findProduct(id) {
  return products.find((product) => product.id === id);
}

// Get the stock record for a product. If there is none yet (first visit,
// or data saved by an older version of this page), we create one on the
// spot, so the rest of the code never has to worry about a missing record.
function getStock(productId) {
  if (!stock[productId]) {
    stock[productId] = { qty: SAMPLE_STOCK_QTY, threshold: SAMPLE_THRESHOLD };
  }
  return stock[productId];
}

// Add up price x qty for everything in the cart
function cartTotal() {
  let total = 0;
  for (const line of cart) {
    const product = findProduct(line.productId);
    total += product.price * line.qty;
  }
  return total;
}

// Read a whole number (0, 1, 2, ...) from an <input>.
// Returns null when the box is empty, negative, or not a whole number.
function readWholeNumber(input) {
  if (input.value.trim() === "") return null;
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

// Show a short message inside the element with this id.
// Normal messages disappear after 3 seconds, error messages (red) after 6.
function showMessage(elementId, text, isError) {
  const messageEl = document.getElementById(elementId);
  messageEl.textContent = text;
  messageEl.classList.toggle("error", Boolean(isError));

  setTimeout(() => {
    // only clear it if a newer message has not replaced it in the meantime
    if (messageEl.textContent === text) messageEl.textContent = "";
  }, isError ? 6000 : 3000);
}

/* ---------------------------------------------------------------------
   5. STOCK CHANGES
   EVERY change to stock goes through this one function, so the stock
   history is always complete. The caller saves and renders afterwards.

   amount: positive to add stock, negative to remove it
   type:   "Sale", "Restock" or "Manual adjustment"
   --------------------------------------------------------------------- */
function changeStock(productId, amount, type) {
  if (amount === 0) return;                     // nothing changed, nothing to record

  const product = findProduct(productId);
  const record  = getStock(productId);
  record.qty += amount;

  stockHistory.push({
    date: new Date().toISOString(),
    productId: productId,
    productName: product ? product.name : "Unknown product",
    type: type,
    change: amount,                             // e.g. -2 for a sale, +10 for a restock
    resulting: record.qty,                      // stock level after this change
  });
}

/* ---------------------------------------------------------------------
   6. CART ACTIONS
   Each action changes the `cart` array, then saves and re-renders.
   --------------------------------------------------------------------- */
function addToCart(productId) {
  const line = cart.find((item) => item.productId === productId);
  if (line) {
    line.qty += 1;                               // already in cart -> add one more
  } else {
    cart.push({ productId: productId, qty: 1 }); // new line in the cart
  }
  saveAndRender();
}

// amount is +1 (plus button) or -1 (minus button)
function changeQty(productId, amount) {
  const line = cart.find((item) => item.productId === productId);
  if (!line) return;

  line.qty += amount;
  if (line.qty <= 0) {
    removeFromCart(productId);                   // going down to 0 removes the line
  } else {
    saveAndRender();
  }
}

function removeFromCart(productId) {
  // keep every line EXCEPT the one with this productId
  cart = cart.filter((item) => item.productId !== productId);
  saveAndRender();
}

/* ---------------------------------------------------------------------
   7. CHECKOUT
   --------------------------------------------------------------------- */
function pay() {
  if (cart.length === 0) return;                 // nothing to pay for

  // Step 1: is there enough stock for every line in the cart?
  const problems = [];
  for (const line of cart) {
    const product   = findProduct(line.productId);
    const available = getStock(product.id).qty;
    if (line.qty > available) {
      problems.push(product.name + " (only " + available + " in stock, cart has " + line.qty + ")");
    }
  }
  if (problems.length > 0) {
    showMessage(
      "pay-message",
      "Not enough stock for " + problems.join(", ") + ". Lower the quantity or restock first.",
      true
    );
    return;                                      // block the checkout
  }

  // Step 2: build a "sale" record. We copy the product name and price
  // into the sale, so the history stays correct even if products change.
  const sale = {
    date: new Date().toISOString(),              // e.g. "2026-10-26T08:30:00.000Z"
    items: cart.map((line) => {
      const product = findProduct(line.productId);
      return { productId: product.id, name: product.name, price: product.price, qty: line.qty };
    }),
    total: cartTotal(),
  };

  // Step 3: take the sold items out of stock (this also writes the stock history)
  for (const line of cart) {
    changeStock(line.productId, -line.qty, "Sale");
  }

  sales.push(sale);                              // add to sales history
  cart = [];                                     // empty the cart
  saveAndRender();

  showMessage("pay-message", "Payment successful! " + formatRupiah(sale.total) + " received.");
}

function clearHistory() {
  const sure = confirm("Delete all sales history?");
  if (!sure) return;

  sales = [];
  saveAndRender();
}

/* ---------------------------------------------------------------------
   8. INVENTORY ACTIONS
   --------------------------------------------------------------------- */

// Called when the "Add a new product" form is submitted
function addProduct(event) {
  event.preventDefault();                        // a form normally reloads the page; we handle it ourselves

  const name      = document.getElementById("new-name").value.trim();
  const category  = document.getElementById("new-category").value.trim();
  const price     = readWholeNumber(document.getElementById("new-price"));
  const startQty  = readWholeNumber(document.getElementById("new-stock"));
  const threshold = readWholeNumber(document.getElementById("new-threshold"));

  if (name === "" || category === "" || price === null || startQty === null || threshold === null) {
    showMessage("inventory-message", "Please fill in every field. Numbers must be whole and not negative.", true);
    return;
  }

  // New id = highest existing id + 1
  let newId = 1;
  for (const product of products) {
    if (product.id >= newId) newId = product.id + 1;
  }

  products.push({ id: newId, name: name, category: category, price: price });
  stock[newId] = { qty: 0, threshold: threshold };
  changeStock(newId, startQty, "Manual adjustment");   // records the starting stock

  saveAndRender();
  renderStockFilter();                           // the dropdown needs the new product too
  document.getElementById("add-product-form").reset();
  showMessage("inventory-message", name + " added.");
}

// "Save" button in the inventory table: set the stock to an exact number
function saveStock(productId, newQty, newThreshold) {
  const product = findProduct(productId);
  const record  = getStock(productId);

  record.threshold = newThreshold;
  changeStock(productId, newQty - record.qty, "Manual adjustment");

  saveAndRender();
  showMessage("inventory-message", product.name + ": stock is now " + newQty + ".");
}

// "Add stock" button in the inventory table: add an amount to the stock
function restock(productId, amount) {
  const product = findProduct(productId);

  changeStock(productId, amount, "Restock");

  saveAndRender();
  showMessage(
    "inventory-message",
    product.name + ": added " + amount + ", stock is now " + getStock(productId).qty + "."
  );
}

/* ---------------------------------------------------------------------
   9. RENDERING (turning data into HTML)
   Each render function builds a piece of HTML text from the data and
   puts it into the page with innerHTML.
   --------------------------------------------------------------------- */

function renderProducts() {
  const list = document.getElementById("product-list");

  // One card per product. map() gives us a list of HTML strings and
  // join("") glues them together into one big string.
  list.innerHTML = products.map((product) => {
    const record   = getStock(product.id);
    const lowClass = record.qty <= record.threshold ? " low" : "";
    return `
      <div class="product-card">
        <span class="category">${escapeHtml(product.category)}</span>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="price">${formatRupiah(product.price)}</p>
        <p class="stock${lowClass}">Stock: ${record.qty}</p>
        <button class="btn btn-primary" data-action="add" data-id="${product.id}">
          Add to cart
        </button>
      </div>
    `;
  }).join("");
}

function renderCart() {
  const tbody    = document.getElementById("cart-items");
  const emptyMsg = document.getElementById("cart-empty");
  const total    = cartTotal();

  tbody.innerHTML = cart.map((line) => {
    const product   = findProduct(line.productId);
    const available = getStock(product.id).qty;

    // warn right away when the cart holds more than we have in stock
    const warning = line.qty > available
      ? `<div class="cart-warning">only ${available} in stock</div>`
      : "";

    return `
      <tr>
        <td>${escapeHtml(product.name)}${warning}</td>
        <td>${formatRupiah(product.price)}</td>
        <td class="qty">
          <button class="btn btn-small" data-action="minus" data-id="${product.id}">-</button>
          <span>${line.qty}</span>
          <button class="btn btn-small" data-action="plus" data-id="${product.id}">+</button>
        </td>
        <td>${formatRupiah(product.price * line.qty)}</td>
        <td>
          <button class="btn btn-small btn-danger" data-action="remove" data-id="${product.id}">Remove</button>
        </td>
      </tr>
    `;
  }).join("");

  // Show "Your cart is empty." only when there is nothing in it
  emptyMsg.hidden = cart.length > 0;

  document.getElementById("cart-total").textContent     = formatRupiah(total);
  document.getElementById("checkout-total").textContent = formatRupiah(total);
  document.getElementById("pay-button").disabled        = cart.length === 0;

  // Number of items shown next to "Cart" in the top menu
  const count = cart.reduce((sum, line) => sum + line.qty, 0);
  document.getElementById("cart-count").textContent = count;
}

function renderSales() {
  const tbody    = document.getElementById("sales-list");
  const emptyMsg = document.getElementById("history-empty");

  // Newest sale first: slice() makes a copy so reverse() does not
  // change the original `sales` array.
  tbody.innerHTML = sales.slice().reverse().map((sale) => {
    // e.g. "Kopi Hitam x2, Roti Bakar x1"
    const itemText = sale.items
      .map((item) => escapeHtml(item.name) + " x" + item.qty)
      .join(", ");

    return `
      <tr>
        <td class="nowrap">${formatDate(sale.date)}</td>
        <td>${itemText}</td>
        <td>${formatRupiah(sale.total)}</td>
      </tr>
    `;
  }).join("");

  emptyMsg.hidden = sales.length > 0;
  document.getElementById("clear-history-button").hidden = sales.length === 0;
}

function renderInventory() {
  const tbody = document.getElementById("inventory-list");

  tbody.innerHTML = products.map((product) => {
    const record = getStock(product.id);
    const isLow  = record.qty <= record.threshold;   // at or below the threshold -> orange row

    return `
      <tr class="${isLow ? "low-stock" : ""}">
        <td>${escapeHtml(product.name)}</td>
        <td>${escapeHtml(product.category)}</td>
        <td class="nowrap">
          <input class="stock-input" type="number" min="0" step="1" value="${record.qty}">
          <button class="btn btn-small" data-action="save-stock" data-id="${product.id}">Save</button>
        </td>
        <td>
          <input class="threshold-input" type="number" min="0" step="1" value="${record.threshold}">
        </td>
        <td class="nowrap">
          <input class="restock-input" type="number" min="1" step="1" placeholder="amount">
          <button class="btn btn-small btn-primary" data-action="restock" data-id="${product.id}">Add stock</button>
        </td>
      </tr>
    `;
  }).join("");
}

// The dropdown above the stock history: "All products" + one option per product.
// Only needs re-drawing when the product list changes.
function renderStockFilter() {
  const select  = document.getElementById("stock-filter");
  const current = select.value;                  // remember the current choice

  select.innerHTML =
    '<option value="all">All products</option>' +
    products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)}</option>`).join("");

  select.value = current || "all";               // put the choice back
}

function renderStockHistory() {
  const tbody    = document.getElementById("stock-history-list");
  const emptyMsg = document.getElementById("stock-history-empty");
  const filter   = document.getElementById("stock-filter").value;   // "all" or a product id (as text)

  let entries = stockHistory.slice().reverse();  // newest first
  if (filter !== "all") {
    entries = entries.filter((entry) => String(entry.productId) === filter);
  }

  tbody.innerHTML = entries.map((entry) => {
    const sign       = entry.change > 0 ? "+" : "";          // show "+10" and "-2"
    const colorClass = entry.change > 0 ? "plus" : "minus";
    return `
      <tr>
        <td class="nowrap">${formatDate(entry.date)}</td>
        <td>${escapeHtml(entry.productName)}</td>
        <td>${entry.type}</td>
        <td class="${colorClass}">${sign}${entry.change}</td>
        <td>${entry.resulting}</td>
      </tr>
    `;
  }).join("");

  emptyMsg.hidden = entries.length > 0;
}

// Save all five pieces of data to localStorage
function saveAll() {
  saveToStorage(PRODUCTS_KEY, products);
  saveToStorage(STOCK_KEY, stock);
  saveToStorage(STOCK_HISTORY_KEY, stockHistory);
  saveToStorage(CART_KEY, cart);
  saveToStorage(SALES_KEY, sales);
}

// Redraw every part of the page from the data
function renderAll() {
  renderProducts();
  renderCart();
  renderSales();
  renderInventory();
  renderStockHistory();
}

function saveAndRender() {
  saveAll();
  renderAll();
}

/* ---------------------------------------------------------------------
   10. EVENT LISTENERS (reacting to clicks)

   The buttons inside the product list, the cart and the inventory table
   are created by JavaScript, so instead of attaching a listener to every
   single button we listen on the parent element once and check which
   button was clicked. This trick is called "event delegation".

   Each button carries two data attributes:
     data-action = what to do ("add", "plus", "minus", "remove", "save-stock", "restock")
     data-id     = the product id
   --------------------------------------------------------------------- */
function handleButtonClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;                           // the click was not on a button

  const action = button.dataset.action;
  const id     = Number(button.dataset.id);      // dataset values are text, so convert

  if (action === "add")    addToCart(id);
  if (action === "plus")   changeQty(id, +1);
  if (action === "minus")  changeQty(id, -1);
  if (action === "remove") removeFromCart(id);
}

function handleInventoryClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id     = Number(button.dataset.id);
  const row    = button.closest("tr");           // the table row this button is in

  if (action === "save-stock") {
    const qty       = readWholeNumber(row.querySelector(".stock-input"));
    const threshold = readWholeNumber(row.querySelector(".threshold-input"));
    if (qty === null || threshold === null) {
      showMessage("inventory-message", "Stock and threshold must be whole numbers, 0 or more.", true);
      return;
    }
    saveStock(id, qty, threshold);
  }

  if (action === "restock") {
    const amount = readWholeNumber(row.querySelector(".restock-input"));
    if (amount === null || amount === 0) {
      showMessage("inventory-message", "Type how many to add (a whole number above 0).", true);
      return;
    }
    restock(id, amount);
  }
}

document.getElementById("product-list").addEventListener("click", handleButtonClick);
document.getElementById("cart-items").addEventListener("click", handleButtonClick);
document.getElementById("pay-button").addEventListener("click", pay);
document.getElementById("clear-history-button").addEventListener("click", clearHistory);
document.getElementById("inventory-list").addEventListener("click", handleInventoryClick);
document.getElementById("add-product-form").addEventListener("submit", addProduct);
document.getElementById("stock-filter").addEventListener("change", renderStockHistory);

/* ---------------------------------------------------------------------
   11. START
   --------------------------------------------------------------------- */
saveAll();            // on the first visit this writes the sample products and stock
renderStockFilter();
renderAll();
