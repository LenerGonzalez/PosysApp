// src/screens/VentaScreen.tsx
import { Picker } from "@react-native-picker/picker";
import { format } from "date-fns";
import {
  addDoc,
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { db } from "../../services/firebase";
import { parseLocaleFloat, show2, to2 } from "../../utils/number";

type Product = {
  id: string;
  productName: string;
  price: number;
  measurement: string; // "lb" | "unidad"
};

export default function VentaScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qtyStr, setQtyStr] = useState(""); // mantiene texto crudo del input
  const [amount, setAmount] = useState(0); // monto calculado (read-only)
  const [clientName, setClientName] = useState("");
  const [msg, setMsg] = useState("");

  // carga productos activos
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "products"));
      const arr: Product[] = [];
      snap.forEach((d) => {
        const x = d.data() as any;
        if (x?.active === false) return;
        arr.push({
          id: d.id,
          productName: x.name ?? x.productName ?? "(sin nombre)",
          price: Number(x.price ?? 0),
          measurement: x.measurement ?? "lb",
        });
      });
      setProducts(arr);
    })();
  }, []);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const isUnit = (selected?.measurement || "").toLowerCase() !== "lb";

  // recalcular monto cuando cambia producto o cantidad
  useEffect(() => {
    const q = parseLocaleFloat(qtyStr);
    const qty = isUnit
      ? Math.max(0, Math.round(q))
      : Math.max(0, Math.round(q * 100) / 100);
    const price = Number(selected?.price || 0);
    setAmount(to2(qty * price));
  }, [qtyStr, selectedProductId, selected?.price, isUnit]);

  // stock disponible por productId (idéntico a tu web)
  async function getDisponibleByProductId(productId: string) {
    if (!productId) return 0;
    const qId = query(
      collection(db, "inventory_batches"),
      where("productId", "==", productId)
    );
    const snap = await getDocs(qId);
    let total = 0;
    snap.forEach((d) => (total += Number((d.data() as any).remaining || 0)));
    return Math.max(0, Math.floor(total * 100) / 100);
  }

  async function handleSave() {
    setMsg("");
    if (!selectedProductId) {
      Alert.alert("Validación", "Selecciona un producto.");
      return;
    }
    const raw = parseLocaleFloat(qtyStr);
    const qty = isUnit
      ? Math.max(0, Math.round(raw))
      : Math.max(0, Math.round(raw * 100) / 100);
    if (qty <= 0) {
      Alert.alert("Validación", "Ingresa una cantidad válida.");
      return;
    }
    try {
      const disp = await getDisponibleByProductId(selectedProductId);
      if (qty > disp) {
        Alert.alert("Stock insuficiente", `Disponible: ${show2(disp)}`);
        return;
      }

      await addDoc(collection(db, "salesV2"), {
        productId: selectedProductId,
        productName: selected?.productName,
        price: selected?.price || 0,
        quantity: qty,
        amount: amount, // ingreso
        amountCharged: amount, // compat
        clientName: clientName.trim(),
        timestamp: Timestamp.now(),
        date: format(new Date(), "yyyy-MM-dd"),
        userEmail: "(vendedor RN)",
        vendor: "vendedor",
        status: "FLOTANTE",
      });

      setMsg("✅ Venta registrada");
      setSelectedProductId("");
      setQtyStr("");
      setClientName("");
      setAmount(0);
    } catch (e: any) {
      setMsg("❌ Error: " + (e?.message || "intenta de nuevo"));
    }
  }

  return (
    <View style={s.wrap}>
      <Text style={s.h1}>Registrar venta</Text>
      <Text style={s.label}>Producto | Precio</Text>
      <View style={s.selectWrap}>
        <Picker
          selectedValue={selectedProductId}
          onValueChange={(val) => setSelectedProductId(val)}
          style={s.select}
        >
          <Picker.Item label="Selecciona un producto..." value="" />
          {products.map((p) => (
            <Picker.Item
              key={p.id}
              label={`${p.productName} — C$ ${p.price.toFixed(2)}`}
              value={p.id}
            />
          ))}
        </Picker>
      </View>

      {/* Cantidad */}
      <Text style={s.label}>Libras - Unidad</Text>
      <TextInput
        style={s.input}
        keyboardType={isUnit ? "number-pad" : "decimal-pad"}
        placeholder={isUnit ? "Unidades" : "Libras (2 decimales)"}
        value={qtyStr}
        onChangeText={setQtyStr}
      />

      {/* Monto (read-only) */}
      <Text style={s.label}>💵 Monto total</Text>
      <TextInput
        style={[s.input, s.readonly]}
        editable={false}
        value={show2(amount)}
      />

      {/* Cliente */}
      <Text style={s.label}>Cliente (opcional)</Text>
      <TextInput
        style={s.input}
        value={clientName}
        onChangeText={setClientName}
        placeholder="Nombre"
      />

      <Button title="Guardar venta" onPress={handleSave} />
      {!!msg && <Text style={s.msg}>{msg}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 16,
    gap: 8,
    backgroundColor: "#fff",
    paddingTop: 80,
    marginBottom: 8,
  },
  h1: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  label: { fontSize: 13, color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    overflow: "hidden", // da bordes redondeados en iOS
    backgroundColor: "#fff", // mantiene look uniforme
  },
  selectWrap: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    marginBottom: 8,
    overflow: "hidden", // 🔑 para que se vea redondeado
  },
  select: {
    height: 200, // 🔑 más compacto, como input
    fontSize: 16,
    color: "black", // texto oscuro
  },

  readonly: { backgroundColor: "#F3F4F6" },
  msg: { marginTop: 8, fontSize: 13 },
});
