// // src/screens/InventarioScreen.tsx
import { Picker } from "@react-native-picker/picker";
import { format } from "date-fns";
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { db } from "../../services/firebase";
import { newBatch } from "../../services/inventory";
import { show2 } from "../../utils/number";

const money = (n: number) => `C$${(Number(n) || 0).toFixed(2)}`;

interface Product {
  id: string;
  name: string;
  category: string;
  measurement: string;
  price: number;
}

interface Batch {
  id: string;
  productId: string;
  productName: string;
  category: string;
  unit: string;
  quantity: number;
  remaining: number;
  purchasePrice: number;
  salePrice: number;
  invoiceTotal?: number;
  expectedTotal?: number;
  date: string; // yyyy-MM-dd
  createdAt: Timestamp;
  status: "PENDIENTE" | "PAGADO";
  notes?: string;
  paidAmount?: number;
  paidAt?: Timestamp;
}

export default function InventarioScreen() {
  // ---------- form crear (tus mismos campos) ----------
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState(""); // seleccionado
  const [productName, setProductName] = useState(""); // derivado del Picker
  const [unit, setUnit] = useState("lb"); // derivado del Picker
  const [qtyStr, setQtyStr] = useState("");
  const [purchaseStr, setPurchaseStr] = useState("");
  const [saleStr, setSaleStr] = useState("");
  const [dateStr, setDateStr] = useState(format(new Date(), "yyyy-MM-dd"));

  // numéricos derivados (como ya llevabas)
  const [quantity, setQuantity] = useState<number>(0);
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [invoiceTotal, setInvoiceTotal] = useState<number>(0);
  const [expectedTotal, setExpectedTotal] = useState<number>(0);

  // ---------- listado ----------
  const [batches, setBatches] = useState<Batch[]>([]);
  const [msg, setMsg] = useState("");

  // ---------- sheet modal ----------
  const [open, setOpen] = useState(false);

  // ✅ CAMBIO 1: reset completo al abrir el modal
  const openSheet = () => {
    setProductId("");
    setProductName("");
    setUnit("lb");
    setQtyStr("");
    setPurchaseStr("");
    setSaleStr("");
    setQuantity(0);
    setPurchasePrice(0);
    setSalePrice(0);
    setInvoiceTotal(0);
    setExpectedTotal(0);
    setMsg("");
    setOpen(true);
    setDateStr(format(new Date(), "yyyy-MM-dd"));
  };
  const closeSheet = () => setOpen(false);

  // cargar products
  useEffect(() => {
    (async () => {
      const psnap = await getDocs(collection(db, "products"));
      const prods: Product[] = [];
      psnap.forEach((d) => {
        const it = d.data() as any;
        prods.push({
          id: d.id,
          name: it.name ?? it.productName ?? "(sin nombre)",
          category: it.category ?? "(sin categoría)",
          measurement: it.measurement ?? "lb",
          price: Number(it.price ?? 0),
        });
      });
      setProducts(prods);
    })();
  }, []);

  // cargar lotes
  useEffect(() => {
    (async () => {
      const qy = query(
        collection(db, "inventory_batches"),
        orderBy("date", "desc")
      );
      const snap = await getDocs(qy);
      const rows: Batch[] = [];
      snap.forEach((d) => {
        const b = d.data() as any;
        rows.push({
          id: d.id,
          productId: b.productId,
          productName: b.productName,
          category: b.category,
          unit: b.unit,
          quantity: Number(b.quantity || 0),
          remaining: Number(b.remaining || 0),
          purchasePrice: Number(b.purchasePrice || 0),
          salePrice: Number(b.salePrice || 0),
          invoiceTotal: Number(b.invoiceTotal || 0),
          expectedTotal: Number(
            b.expectedTotal ??
              (Number(b.quantity || 0) * Number(b.salePrice || 0) || 0)
          ),
          date: b.date,
          createdAt: b.createdAt,
          status: b.status,
          notes: b.notes,
          paidAmount: Number(b.paidAmount || 0),
          paidAt: b.paidAt,
        });
      });
      setBatches(rows);
    })();
  }, []);

  // sugerir salePrice del producto elegido
  useEffect(() => {
    const p = products.find((x) => x.id === productId);
    if (p) setSalePrice(Number(p.price || 0));
  }, [productId, products]);

  // cálculos automáticos (crear)
  useEffect(() => {
    setInvoiceTotal(Math.floor(quantity * purchasePrice * 100) / 100);
  }, [quantity, purchasePrice]);
  useEffect(() => {
    setExpectedTotal(Math.floor(quantity * salePrice * 100) / 100);
  }, [quantity, salePrice]);

  // producto seleccionado (derivar nombre/unidad y sugerir venta si está vacío)
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) || null,
    [products, productId]
  );

  useEffect(() => {
    if (!selectedProduct) {
      setProductName("");
      setUnit("Lb");
      return;
    }
    setProductName(selectedProduct.name);
    setUnit(selectedProduct.measurement || "Lb");
    if (!saleStr) setSaleStr(String(selectedProduct.price ?? ""));
  }, [selectedProduct]); // no toco tus textos/inputs

  const totals = useMemo(() => {
    const qty = batches.reduce((a, b) => a + (b.quantity || 0), 0);
    const rem = batches.reduce((a, b) => a + (b.remaining || 0), 0);
     const totalFacturado = batches.reduce(
       (a, b) => a + (b.invoiceTotal || 0),
       0
     );
     const totalEsperado = batches.reduce(
       (a, b) => a + (b.expectedTotal || 0),
       0
     );
     return { qty, rem, totalFacturado, totalEsperado };
  }, [batches]);

  async function handleCreate() {
    setMsg("");

    // Usar los estados numéricos actuales del modal
    const qSafe =
      unit.toLowerCase() === "lb"
        ? Math.max(0, parseFloat((quantity || 0).toFixed(2)))
        : Math.max(0, Math.round(quantity || 0));

    const pPrice = Number.isFinite(purchasePrice)
      ? parseFloat(purchasePrice.toFixed(2))
      : 0;
    const sPrice = Number.isFinite(salePrice)
      ? parseFloat(salePrice.toFixed(2))
      : 0;

    // validar por productId (no por nombre)
    const p = products.find((x) => x.id === productId);
    if (!p || qSafe <= 0 || pPrice <= 0) {
      Alert.alert("Validación", "Completa producto, cantidad y costo.");
      return;
    }

    try {
      const invTotal = Math.floor(qSafe * pPrice * 100) / 100;
      const expTotal = Math.floor(qSafe * sPrice * 100) / 100;

      const ref = await newBatch({
        productId: p.id,
        productName: p.name,
        category: p.category, // 👈 importante para la web
        unit: p.measurement,
        quantity: qSafe,
        purchasePrice: pPrice,
        salePrice: sPrice,
        invoiceTotal: invTotal,
        expectedTotal: expTotal,
        date: dateStr,
      });

      setBatches((prev) => [
        {
          id: ref.id,
          productId: p.id,
          productName: p.name,
          category: p.category,
          unit: p.measurement,
          quantity: qSafe,
          remaining: qSafe,
          purchasePrice: pPrice,
          salePrice: sPrice,
          invoiceTotal: invTotal,
          expectedTotal: expTotal,
          date: dateStr,
          createdAt: Timestamp.now(),
          status: "PENDIENTE",
        },
        ...prev,
      ]);

      Alert.alert("✅ Lote creado");

      // reset
      setProductId("");
      setProductName("");
      setUnit("lb");
      setQtyStr("");
      setPurchaseStr("");
      setSaleStr("");
      setQuantity(0);
      setPurchasePrice(0);
      setSalePrice(p.price || 0);
      setInvoiceTotal(0);
      setExpectedTotal(0);

      closeSheet();
    } catch (e: any) {
      setMsg("❌ Error: " + (e?.message || "intenta de nuevo"));
    }
  }

  return (
    <View style={s.wrap}>
      <Text style={s.h1}>Inventario por lotes</Text>

      {/* Lista SIEMPRE visible */}
      <View style={s.cardTotals}>
        <Text style={{ fontSize: 20, fontWeight: "bold" }}>Libras Totales</Text>
        <Text style={{ fontSize: 18, color: "#007FFF", fontWeight: "bold" }}>
          - Ingresadas: {show2(totals.qty)}
        </Text>
        <Text style={{ fontSize: 18, color: "#AB274F", fontWeight: "bold" }}>
          - Restantes: {show2(totals.rem)}
        </Text>
        </View>
      <View style={s.cardTotals}>
        <Text style={{ fontSize: 20, fontWeight: "bold" }}>
          Dinero Total (C$)
        </Text>
        <Text style={{ fontSize: 18, color: "#007FFF", fontWeight: "bold" }}>
          - Total facturado: {show2(totals.totalFacturado)}
        </Text>
        <Text style={{ fontSize: 18, color: "#AB274F", fontWeight: "bold" }}>
          - Total esperado: {show2(totals.totalEsperado)}
        </Text>{" "}
      </View>

      <FlatList
        style={{ marginTop: 16 }}
        data={batches}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.cardTitle}>
              {item.productName} • {item.date}
            </Text>
            <Text style={{ fontSize: 15, color: "#6B7280" }}>
              Unidad: {item.unit.toUpperCase()}
            </Text>
            <Text style={s.cardItem}>
              Ingresado: {show2(item.quantity)} Libras | Restante:{" "}
              {show2(item.remaining)} Libras
            </Text>
            <Text style={s.cardItem}>
              Precio Compra: C${show2(item.purchasePrice)} | Precio Venta: C$
              {show2(item.salePrice)}
            </Text>
            <Text style={{ fontSize: 15, color: "#6B7280" }}>
              Estado: {item.status}
            </Text>
          </View>
        )}
      />

      {!!msg && <Text style={s.msg}>{msg}</Text>}

      {/* FAB para abrir el sheet */}
      <Pressable
        style={s.fab}
        onPress={openSheet}
        accessibilityLabel="Nuevo lote"
      >
        <Text style={s.fabPlus}>＋</Text>
      </Pressable>

      {/* SHEET: tu MISMO formulario, solo dentro del Modal */}
      <Modal
        transparent
        animationType="slide"
        visible={open}
        onRequestClose={closeSheet}
      >
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Nuevo lote</Text>
              <Pressable onPress={closeSheet} hitSlop={10}>
                <Text style={s.close}>Cerrar</Text>
              </Pressable>
            </View>

            {/* Picker de productos (igual) */}
            <View style={s.selectWrap}>
              <Picker
                selectedValue={productId}
                onValueChange={(val) => setProductId(val)}
                style={s.select}
              >
                <Picker.Item
                  label="Selecciona un producto…"
                  value=""
                  color="#9CA3AF"
                />
                {products.map((p) => (
                  <Picker.Item
                    key={p.id}
                    value={p.id}
                    label={`${p.name} — Precio: ${money(p.price)}`}
                  />
                ))}
              </Picker>
            </View>

            {/* Nombre y unidad: derivados del producto (no editables) */}
            <Text style={s.label}>Nombre</Text>
            <TextInput
              style={[s.input, s.readonly]}
              value={productName}
              editable={false}
              placeholder="(selecciona un producto)"
            />

            <Text style={s.label}>Unidad (lb/unidad)</Text>
            <TextInput
              style={[s.input, s.readonly]}
              value={unit}
              editable={false}
              placeholder="lb"
            />

            {/* ✅ CAMBIO 2: inputs con string + normalización en onBlur */}
            <Text style={s.label}>Cantidad</Text>
            <TextInput
              style={s.input}
              keyboardType={
                unit.toLowerCase() === "lb" ? "decimal-pad" : "number-pad"
              }
              placeholder={unit.toLowerCase() === "lb" ? "0.000" : "0"}
              value={qtyStr}
              onChangeText={(text) => {
                const t = text.replace(",", ".");
                const re =
                  unit.toLowerCase() === "lb" ? /^\d*([.]\d{0,3})?$/ : /^\d*$/;
                if (t === "" || re.test(t)) setQtyStr(t);
              }}
              onBlur={() => {
                const raw = qtyStr.trim() === "" ? "0" : qtyStr;
                const q = parseFloat(raw);
                if (!isNaN(q)) {
                  const qSafe =
                    unit.toLowerCase() === "lb"
                      ? Number(q.toFixed(3))
                      : Math.round(q);
                  setQtyStr(
                    unit.toLowerCase() === "lb"
                      ? qSafe.toFixed(3)
                      : String(qSafe)
                  );
                  setQuantity(qSafe);
                } else {
                  setQtyStr("");
                  setQuantity(0);
                }
              }}
            />

            <Text style={s.label}>Precio compra</Text>
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              placeholder="0.00"
              value={purchaseStr}
              onChangeText={(text) => {
                const t = text.replace(",", ".");
                const re = /^\d*([.]\d{0,2})?$/;
                if (t === "" || re.test(t)) setPurchaseStr(t);
              }}
              onBlur={() => {
                const p = parseFloat(purchaseStr || "0");
                if (!isNaN(p)) {
                  const pSafe = Number(p.toFixed(2));
                  setPurchaseStr(pSafe.toFixed(2));
                  setPurchasePrice(pSafe);
                } else {
                  setPurchaseStr("");
                  setPurchasePrice(0);
                }
              }}
            />

            <Text style={s.label}>Precio venta</Text>
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              placeholder="0.00"
              value={saleStr}
              onChangeText={(text) => {
                const t = text.replace(",", ".");
                const re = /^\d*([.]\d{0,2})?$/;
                if (t === "" || re.test(t)) setSaleStr(t);
              }}
              onBlur={() => {
                const s = parseFloat(saleStr || "0");
                if (!isNaN(s)) {
                  const sSafe = Number(s.toFixed(2));
                  setSaleStr(sSafe.toFixed(2));
                  setSalePrice(sSafe);
                } else {
                  setSaleStr("");
                  setSalePrice(0);
                }
              }}
            />

            <Text style={s.label}>Fecha (yyyy-MM-dd)</Text>
            <TextInput
              style={s.input}
              value={dateStr}
              onChangeText={setDateStr}
            />

            <View style={{ marginTop: 12 }}>
              <Button title="Guardar lote" onPress={handleCreate} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 16,
    gap: 8,
    backgroundColor: "#fff",
    paddingTop: 100,
  },
  h1: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  label: { fontSize: 14, color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    padding: 10,
    fontSize: 13,
  },
  readonly: { backgroundColor: "#F3F4F6" },
  msg: { marginTop: 8, fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    padding: 12,
    marginBottom: 5,
  },
  cardTotals: {
    borderWidth: 0.5,
    borderColor: "#007FFF",
    borderRadius: 20,
    padding: 12,
    marginBottom: 1,
    backgroundColor: "#F5F5F5",
  },
  selectWrap: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  select: {
    height: 150,
    fontSize: 16,
    color: "#111827",
  },
  cardTitle: {
    fontWeight: "700",
    marginBottom: 4,
    fontSize: 17,
    color: "black",
  },
  cardItem: { fontSize: 16, color: "black", marginBottom: 2 },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    backgroundColor: "gray",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fabPlus: { color: "white", fontSize: 28 },

  // Sheet
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 8,
    height: "86%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", flex: 1 },
  close: { color: "#2563EB", fontWeight: "600" },
});
