"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Filter,
  Gift,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Tag,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const CATEGORIES = ["All", "Supplements", "Accessories", "Apparel", "Equipment"];
const sampleProducts = [
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

type CartItem = (typeof sampleProducts)[number] & { qty: number };

export default function ShopPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("featured");
  const [price, setPrice] = useState("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);

  const filtered = useMemo(() => {
    let list = [...sampleProducts];
    if (category !== "All") list = list.filter((p) => p.category === category);
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    if (price !== "all") {
      if (price === "0-25") list = list.filter((p) => p.price <= 25);
      else if (price === "25-50") list = list.filter((p) => p.price > 25 && p.price <= 50);
      else list = list.filter((p) => p.price > 50);
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
  }, [q, category, sort, price]);

  const addToCart = (product: (typeof sampleProducts)[number]) => {
    setItems((arr) => {
      const existing = arr.find((it) => it.id === product.id);
      if (existing) {
        return arr.map((it) =>
          it.id === product.id ? { ...it, qty: it.qty + 1 } : it,
        );
      }
      return [...arr, { ...product, qty: 1 }];
    });
    setCartOpen(true);
  };

  const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Marketplace</h1>
            <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Personalized shop for members.
            </p>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 dark:bg-night-accent"
          >
            <ShoppingCart className="h-4 w-4" />
            Cart (${total.toFixed(2)})
          </button>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.05 }}
        className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Tag className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
            <div>
              <div className="text-sm font-semibold">Flash Deal: 20% off apparel</div>
              <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                Ends in 02:14:47
              </div>
            </div>
          </div>
          <button className="rounded-full border border-day-border px-4 py-2 text-xs font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover">
            Shop Now
          </button>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-day-text-secondary dark:text-night-text-secondary" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search products..."
                className="w-full rounded-lg border border-day-border bg-day-card py-2 pl-10 pr-4 text-sm text-day-text-primary placeholder-day-text-secondary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:placeholder-night-text-secondary dark:focus:ring-night-accent"
              />
            </div>
          </div>
          <select
            className="rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm text-day-text-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm text-day-text-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
            <select
              className="rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm text-day-text-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary"
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
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.15 }}
        className="grid gap-6 lg:grid-cols-[2fr_1fr]"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card transition hover:-translate-y-1 hover:shadow-lg dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
            >
              <div className="aspect-square overflow-hidden rounded-xl bg-day-hover dark:bg-night-hover">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-day-text-secondary dark:text-night-text-secondary">
                    No Image
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{product.name}</div>
                  <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                    {product.brand}
                  </div>
                </div>
                <span className="rounded-full bg-day-hover px-2 py-0.5 text-[11px] font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                  {product.category}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={`${product.id}-star-${i}`}
                    className={`h-4 w-4 ${
                      i < Math.round(product.rating) ? "fill-amber-500" : "opacity-30"
                    }`}
                  />
                ))}
                <span className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                  {product.rating}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-lg font-bold">${product.price.toFixed(2)}</div>
                <button
                  onClick={() => addToCart(product)}
                  className="rounded-full bg-day-accent-primary px-3 py-1 text-xs font-semibold text-white dark:bg-night-accent"
                >
                  Add to Cart
                </button>
              </div>
              <div className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
                {product.stock} in stock
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Filter className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
              Recommendations
            </div>
            <div className="mt-3 space-y-3">
              {sampleProducts.slice(0, 3).map((product) => (
                <div key={`rec-${product.id}`} className="flex items-center justify-between text-sm">
                  <div className="line-clamp-1">{product.name}</div>
                  <button
                    onClick={() => addToCart(product)}
                    className="rounded-full border border-day-border px-3 py-1 text-xs font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Truck className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
              Order Tracking
            </div>
            <div className="mt-3 space-y-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
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
      </motion.section>

      <AnimatePresence>
        {cartOpen ? (
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              className="absolute inset-0 bg-black/40"
              onClick={() => setCartOpen(false)}
              aria-label="Close cart"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="absolute right-0 top-0 h-full w-full max-w-md border-l border-day-border bg-day-card p-4 shadow-xl dark:border-night-border dark:bg-night-card"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Your Cart</h3>
                <span className="rounded-full bg-day-accent-primary px-3 py-1 text-xs font-semibold text-white dark:bg-night-accent">
                  ${total.toFixed(2)}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {items.length === 0 ? (
                  <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                    Cart is empty.
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={`cart-${item.id}`}
                      className="rounded-xl border border-day-border p-3 text-sm dark:border-night-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 overflow-hidden rounded-lg bg-day-hover dark:bg-night-hover">
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{item.name}</div>
                          <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                            ${item.price.toFixed(2)}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() =>
                                setItems((arr) =>
                                  arr.map((it) =>
                                    it.id === item.id
                                      ? { ...it, qty: Math.max(1, it.qty - 1) }
                                      : it,
                                  ),
                                )
                              }
                              className="rounded-full border border-day-border p-1 dark:border-night-border"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span>{item.qty}</span>
                            <button
                              onClick={() =>
                                setItems((arr) =>
                                  arr.map((it) =>
                                    it.id === item.id ? { ...it, qty: it.qty + 1 } : it,
                                  ),
                                )
                              }
                              className="rounded-full border border-day-border p-1 dark:border-night-border"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() =>
                                setItems((arr) => arr.filter((it) => it.id !== item.id))
                              }
                              className="ml-auto text-xs text-day-text-secondary hover:text-day-text-primary dark:text-night-text-secondary dark:hover:text-night-text-primary"
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
              <button
                className="mt-4 w-full rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-night-accent"
                disabled={items.length === 0}
              >
                Checkout
              </button>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
