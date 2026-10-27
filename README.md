# POS Practice

A tiny Point-of-Sale (cashier) web page for practice. It is built with
plain HTML, CSS and JavaScript only. There is no server, no database and
nothing to install: all data is kept in your browser's `localStorage`.

## Files

| File         | What it does                                                            |
|--------------|-------------------------------------------------------------------------|
| `index.html` | The page structure: products, cart, checkout, sales history, inventory, stock history |
| `style.css`  | Colours, layout, tables, forms and buttons                              |
| `app.js`     | All the logic: cart, paying, stock, and saving to localStorage          |

## How to open it

1. Open the `pos-practice` folder in File Explorer.
2. Double-click `index.html`. It opens in your default browser.

That is all. You can also drag `index.html` onto an open browser window,
or press `Ctrl + O` inside the browser and pick the file.

Everything is on one page. The links in the top bar jump to each part:
Products, Cart, Checkout, Sales History, Inventory and Stock History.

## How to use it

1. **Products** - click *Add to cart* on any product. Each card shows the
   current stock.
2. **Cart** - use **+** / **-** to change quantities, or *Remove* a line.
3. **Checkout** - click **Pay**. The cart is emptied, the sale is saved and
   the sold items are taken out of stock. If the cart holds more of a
   product than you have in stock, the payment is blocked and a red message
   names the product and how many are left.
4. **Sales History** - every past sale with date, items and total.
5. **Inventory** - one row per product with its stock and its low-stock
   threshold. Change the numbers and click **Save**, or type an amount and
   click **Add stock**. Rows turn orange when stock is at or below the
   threshold. The form at the top adds a new product, which also appears
   in the Products list.
6. **Stock History** - every stock change (Sale, Restock or Manual
   adjustment) with date and time, quantity changed and resulting stock,
   newest first. Use the dropdown to show one product only.

Prices are shown in Indonesian Rupiah, for example `Rp 25.000`.

## Where is the data?

In the browser's localStorage, under five keys:

- `pos-practice-products` - the product list (name, price, category)
- `pos-practice-stock` - stock quantity and threshold, per product id
- `pos-practice-stock-history` - every stock change
- `pos-practice-cart` - the current cart
- `pos-practice-sales` - the list of past sales

The six sample products are written to localStorage on the first visit,
with 20 in stock and a threshold of 5. If a product has no stock record
(for example data saved by an older version of this page), one is created
with those same numbers, so nothing crashes.

The data survives a page refresh, but it only exists in this browser on
this computer. **Clear history** only deletes the sales list. To reset
everything, open the browser DevTools (`F12`), go to the Console tab and run:

```js
localStorage.clear()
```

Then refresh the page. The sample products come back.

## Things to try next

- Add a product with the Inventory form, then sell it until its stock is 0.
- Change the colours in the `:root` block at the top of `style.css`.
- Show how many sales were made today above the sales history table.
- Add a "Delete product" button to the Inventory table.
