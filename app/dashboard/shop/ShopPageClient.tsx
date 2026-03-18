"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  Gift,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Tag,
  Truck,
} from "lucide-react";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  rating: number;
  category: string;
  brand: string;
  image: string;
  desc: string;
};

type CartItem = Product & { qty: number };

const CATEGORIES = ["All", "Supplements", "Accessories", "Apparel", "Equipment"];

const sampleProducts: Product[] = [
  {
    id: "s1",
    name: "Whey Protein Isolate",
    price: 39.99,
    stock: 23,
    rating: 4.6,
    category: "Supplements",
    brand: "BioLift",
    image: "https://m.media-amazon.com/images/I/61IqOJ0JJQL._AC_SL1500_.jpg",
    desc: "High quality isolate with fast absorption.",
  },
  {
    id: "s2",
    name: "Resistance Bands Set",
    price: 19.99,
    stock: 48,
    rating: 4.4,
    category: "Accessories",
    brand: "FlexFit",
    image:
      "https://th.bing.com/th?id=OPAC.ZigxuglFgq7%2fMg474C474&w=220&h=220&c=17&o=5&pid=21.1",
    desc: "Multi-resistance bands for full-body workouts.",
  },
  {
    id: "s3",
    name: "Dry-Fit Tee",
    price: 24.99,
    stock: 120,
    rating: 4.2,
    category: "Apparel",
    brand: "BioLift",
    image:
      "https://5.imimg.com/data5/SELLER/Default/2022/10/MN/ML/BD/7313559/mens-sports-dry-fit-t-shirts-1000x1000.png",
    desc: "Breathable, moisture-wicking training tee.",
  },
  {
    id: "s4",
    name: "Adjustable Dumbbells",
    price: 249.99,
    stock: 8,
    rating: 4.8,
    category: "Equipment",
    brand: "IronPro",
    image: "https://m.media-amazon.com/images/I/81-5vsFdaJL._AC_SL1500_.jpg",
    desc: "Space-saving adjustable dumbbells (5-52.5 lb).",
  },
];

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (product: Product) => void;
}) {
  return (
    <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
      <div className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-day-border dark:bg-night-border">
        {product.image ? (
          <div className="relative h-full w-full">
            {/* External UI-reference image URLs intentionally bypass next/image host config. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <span className="text-xs text-day-text-secondary dark:text-night-text-secondary">
            No Image
          </span>
        )}
      </div>

      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="line-clamp-1 font-semibold text-day-text-primary dark:text-night-text-primary">
          {product.name}
        </h3>
        <span className="rounded-full border border-day-border px-2.5 py-1 text-[11px] font-semibold text-day-text-secondary dark:border-night-border dark:text-night-text-secondary">
          {product.brand}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-1 text-yellow-500">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={`${product.id}-star-${index}`}
            className={`h-4 w-4 ${
              index < Math.round(product.rating) ? "fill-yellow-500" : "opacity-30"
            }`}
          />
        ))}
        <span className="ml-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
          {product.rating}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-lg font-bold text-day-text-primary dark:text-night-text-primary">
          ${product.price.toFixed(2)}
        </div>
        <button
          type="button"
          onClick={() => onAdd(product)}
          className="rounded-full bg-day-accent-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-night-accent"
        >
          Add to Cart
        </button>
      </div>

      <div className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
        {product.stock} in stock
      </div>
    </div>
  );
}

function FiltersBar({
  q,
  setQ,
  category,
  setCategory,
  sort,
  setSort,
  price,
  setPrice,
}: {
  q: string;
  setQ: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  price: string;
  setPrice: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-day-text-secondary dark:text-night-text-secondary" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search products..."
              className="w-full rounded-lg border border-day-border bg-day-card py-3 pl-10 pr-4 text-sm text-day-text-primary placeholder-day-text-secondary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:placeholder-night-text-secondary dark:focus:ring-night-accent"
            />
          </div>
        </div>

        <div>
          <select
            className="w-full rounded-lg border border-day-border bg-day-card p-3 text-sm text-day-text-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            className="rounded-lg border border-day-border bg-day-card p-3 text-sm text-day-text-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>

          <select
            className="rounded-lg border border-day-border bg-day-card p-3 text-sm text-day-text-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          >
            <option value="all">All Prices</option>
            <option value="0-25">$0 - $25</option>
            <option value="25-50">$25 - $50</option>
            <option value=">50">$50+</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function PromotionsStrip() {
  return (
    <div className="rounded-2xl border border-day-border bg-gradient-to-r from-day-accent-primary/10 to-day-accent-secondary/10 p-4 shadow-card dark:border-night-border dark:from-night-accent/10 dark:to-red-600/10 dark:shadow-card-dark">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Tag className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
          <div>
            <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
              Flash Deal: 20% off apparel
            </div>
            <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
              Ends in 02:14:47
            </div>
          </div>
        </div>
        <button
          type="button"
          className="rounded-full border border-day-border px-4 py-2 text-sm font-semibold text-day-text-primary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-primary dark:hover:bg-night-hover"
        >
          Shop Now
        </button>
      </div>
    </div>
  );
}

function CartDrawer({
  open,
  onClose,
  items,
  setItems,
}: {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  setItems: Dispatch<SetStateAction<CartItem[]>>;
}) {
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const updateQty = (id: string, delta: number) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item,
      ),
    );
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            aria-label="Close cart"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute right-0 top-0 h-full w-full overflow-y-auto border-l border-day-border bg-day-card p-4 sm:w-[420px] dark:border-night-border dark:bg-night-card"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-day-text-primary dark:text-night-text-primary">
                Your Cart
              </h3>
              <span className="rounded-full bg-day-accent-primary px-3 py-1 text-xs font-semibold text-white dark:bg-night-accent">
                ${total.toFixed(2)}
              </span>
            </div>

            <div className="space-y-3">
              {items.length === 0 ? (
                <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Cart is empty
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-day-border bg-day-card p-3 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 rounded bg-day-border dark:bg-night-border" />
                      <div className="flex-1">
                        <div className="line-clamp-1 font-semibold text-day-text-primary dark:text-night-text-primary">
                          {item.name}
                        </div>
                        <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                          ${item.price.toFixed(2)}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, -1)}
                            className="rounded-lg border border-day-border p-1.5 transition hover:bg-day-hover dark:border-night-border dark:hover:bg-night-hover"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span>{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, 1)}
                            className="rounded-lg border border-day-border p-1.5 transition hover:bg-day-hover dark:border-night-border dark:hover:bg-night-hover"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="ml-auto text-sm text-day-text-secondary transition hover:text-day-text-primary dark:text-night-text-secondary dark:hover:text-night-text-primary"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4">
              <button
                type="button"
                disabled={items.length === 0}
                className="w-full rounded-lg bg-day-accent-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-night-accent"
              >
                Checkout
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function ShopPageClient() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("featured");
  const [price, setPrice] = useState("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);

  const filtered = useMemo(() => {
    let list = [...sampleProducts];

    if (category !== "All") {
      list = list.filter((product) => product.category === category);
    }

    if (q) {
      list = list.filter((product) =>
        product.name.toLowerCase().includes(q.toLowerCase()),
      );
    }

    if (price !== "all") {
      if (price === "0-25") {
        list = list.filter((product) => product.price <= 25);
      } else if (price === "25-50") {
        list = list.filter((product) => product.price > 25 && product.price <= 50);
      } else {
        list = list.filter((product) => product.price > 50);
      }
    }

    switch (sort) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
      default:
        break;
    }

    return list;
  }, [category, price, q, sort]);

  const addToCart = (product: Product) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item,
        );
      }

      return [...current, { ...product, qty: 1 }];
    });

    setCartOpen(true);
  };

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
              Marketplace
            </h1>
            <p className="text-day-text-secondary dark:text-night-text-secondary">
              Personalized shop for members
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-night-accent"
          >
            <ShoppingCart className="h-5 w-5" />
            Cart
          </button>
        </div>
      </motion.div>

      <PromotionsStrip />

      <FiltersBar
        q={q}
        setQ={setQ}
        category={category}
        setCategory={setCategory}
        sort={sort}
        setSort={setSort}
        price={price}
        setPrice={setPrice}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="grid grid-cols-1 gap-4 md:col-span-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={addToCart} />
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <h3 className="mb-3 font-semibold text-day-text-primary dark:text-night-text-primary">
              Recommendations
            </h3>
            <div className="space-y-3">
              {sampleProducts.slice(0, 3).map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3">
                  <div className="line-clamp-1 text-sm text-day-text-primary dark:text-night-text-primary">
                    {product.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    className="rounded-full border border-day-border px-3 py-1 text-sm font-medium text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <h3 className="mb-2 font-semibold text-day-text-primary dark:text-night-text-primary">
              Order Tracking
            </h3>
            <div className="space-y-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Shipped
              </div>
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Delivered
              </div>
            </div>
          </div>
        </div>
      </div>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={items}
        setItems={setItems}
      />
    </div>
  );
}
