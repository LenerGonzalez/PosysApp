// src/screens/ProductScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Modal,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { db } from "../../services/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  measurement: string;
  active?: boolean;
};

const money = (n: number) => `C$${(Number(n) || 0).toFixed(2)}`;

const CATEGORIES = [
  { label: "Selecciona", value: "" },
  { label: "Pollo", value: "pollo" },
  { label: "Cerdo", value: "cerdo" },
  { label: "Huevos", value: "huevo" },
  { label: "Ropa", value: "ropa" },
  { label: "Otros", value: "otros" },
] as const;

const MEASUREMENTS = [
  { label: "Selecciona", value: "" },
  { label: "Libra", value: "lb" },
  { label: "Kilogramo", value: "kg" },
  { label: "Unidad", value: "unidad" },
] as const;

export default function ProductScreen() {
  // Form crear
  const [name, setName] = useState("");
  const [price, setPrice] = useState<string>(""); // mantener como string para inputs RN
  const [category, setCategory] = useState("");
  const [measurement, setMeasurement] = useState("");
  const [message, setMessage] = useState("");

  // Listado
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Edición (modal)
  const [editing, setEditing] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editMeasurement, setEditMeasurement] = useState("");
  const [editPrice, setEditPrice] = useState<string>("");

  // Cargar productos
  const loadProducts = async () => {
    setLoadingList(true);
    const snap = await getDocs(collection(db, "products"));
    const rows: Product[] = [];
    snap.forEach((d) => {
      const it = d.data() as any;
      rows.push({
        id: d.id,
        name: it.name ?? "",
        price: Number(it.price ?? 0),
        category: it.category ?? "",
        measurement: it.measurement ?? "",
        active: it.active !== false, // default true
      });
    });
    // Opcional: ordenar por nombre
    rows.sort((a, b) => a.name.localeCompare(b.name));
    setProducts(rows);
    setLoadingList(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const visibleRows = useMemo(
    () =>
      showInactive ? products : products.filter((p) => p.active !== false),
    [products, showInactive]
  );

  // Crear
  const handleCreate = async () => {
    setMessage("");
    const parsedPrice = parseFloat(price || "0");
    if (!name.trim() || !(parsedPrice > 0) || !measurement) {
      setMessage("❌ Completa nombre, precio válido y unidad de medida");
      return;
    }
    try {
      const payload = {
        name: name.trim(),
        price: Number(parsedPrice.toFixed(2)),
        category,
        measurement,
        active: true,
      };
      const newRef = await addDoc(collection(db, "products"), payload);
      setProducts((prev) => [{ id: newRef.id, ...payload }, ...prev]);
      setMessage("✅ Producto registrado con éxito.");
      setName("");
      setPrice("");
      setCategory("");
      setMeasurement("");
    } catch (err: any) {
      setMessage("❌ Error: " + err.message);
    }
  };

  // Editar
  const startEdit = (p: Product) => {
    setEditing(p);
    setEditName(p.name);
    setEditCategory(p.category);
    setEditMeasurement(p.measurement);
    setEditPrice(String(p.price));
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditName("");
    setEditCategory("");
    setEditMeasurement("");
    setEditPrice("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const parsed = parseFloat(editPrice || "0");
    if (!editName.trim() || !(parsed > 0) || !editMeasurement) {
      Alert.alert("Validación", "Completa nombre, precio válido y unidad.");
      return;
    }
    const ref = doc(db, "products", editing.id);
    await updateDoc(ref, {
      name: editName.trim(),
      category: editCategory,
      measurement: editMeasurement,
      price: Number(parsed.toFixed(2)),
    });
    setProducts((prev) =>
      prev.map((x) =>
        x.id === editing.id
          ? {
              ...x,
              name: editName.trim(),
              category: editCategory,
              measurement: editMeasurement,
              price: Number(parsed.toFixed(2)),
            }
          : x
      )
    );
    cancelEdit();
  };

  // Activar / Desactivar
  const toggleActive = async (p: Product) => {
    const newActive = !(p.active !== false);
    await updateDoc(doc(db, "products", p.id), { active: newActive });
    setProducts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, active: newActive } : x))
    );
  };

  // Eliminar (con validación de lotes)
  const deleteProduct = async (p: Product) => {
    // 1) verificar lotes asociados
    const qB = query(
      collection(db, "inventory_batches"),
      where("productId", "==", p.id),
      limit(1)
    );
    const hasBatches = !(await getDocs(qB)).empty;
    if (hasBatches) {
      Alert.alert(
        "No se puede eliminar",
        "Hay lotes asociados a este producto.\nSugerencia: desactívalo para ocultarlo."
      );
      return;
    }

    // 2) confirmar
    Alert.alert(
      "Eliminar",
      `¿Eliminar definitivamente "${p.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "products", p.id));
            setProducts((prev) => prev.filter((x) => x.id !== p.id));
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Render item lista
  const renderItem = ({ item }: { item: Product }) => {
    const isActive = item.active !== false;
    return (
      <View style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={[styles.name, !isActive && styles.inactiveText]}>
            {item.name}
          </Text>
          <Text style={styles.meta}>
            {item.category || "—"} · {item.measurement || "—"}
          </Text>
          <Text style={styles.price}>{money(item.price)}</Text>
        </View>

        <View style={styles.rowActions}>
          <Pressable
            style={[styles.btn, styles.btnEdit]}
            onPress={() => startEdit(item)}
          >
            <Text style={styles.btnText}>Editar</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, isActive ? styles.btnGray : styles.btnGreen]}
            onPress={() => toggleActive(item)}
          >
            <Text style={styles.btnText}>
              {isActive ? "Desactivar" : "Activar"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnDanger]}
            onPress={() => deleteProduct(item)}
          >
            <Text style={styles.btnText}>Eliminar</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Registrar producto</Text>

        {/* Formulario de creación */}
        <View style={styles.card}>
          <Text style={styles.label}>Categoría</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={category}
              onValueChange={(v) => setCategory(String(v))}
            >
              {CATEGORIES.map((c) => (
                <Picker.Item key={c.value} label={c.label} value={c.value} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Unidad de medida</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={measurement}
              onValueChange={(v) => setMeasurement(String(v))}
            >
              {MEASUREMENTS.map((m) => (
                <Picker.Item key={m.value} label={m.label} value={m.value} />
              ))}
            </Picker>
          </View>
          <Text style={styles.label}>Nombre del producto</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ej: Pechuga de pollo"
          />

          <Text style={styles.label}>Precio por unidad (ej: 55.50)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />

          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleCreate}
          >
            <Text style={styles.btnText}>Agregar producto</Text>
          </Pressable>

          {!!message && <Text style={styles.message}>{message}</Text>}
        </View>

        {/* Controles de lista */}
        <View style={styles.listHeader}>
          <Text style={styles.subtitle}>Productos</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Mostrar inactivos</Text>
            <Switch value={showInactive} onValueChange={setShowInactive} />
          </View>
        </View>

        {/* Lista */}
        <View style={styles.card}>
          {loadingList ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" />
              <Text style={{ marginTop: 8 }}>Cargando…</Text>
            </View>
          ) : visibleRows.length === 0 ? (
            <View style={styles.center}>
              <Text>Sin productos</Text>
            </View>
          ) : (
            <FlatList
              data={visibleRows}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      {/* Modal de edición */}
      <Modal visible={!!editing} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar producto</Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
            />

            <Text style={styles.label}>Categoría</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={editCategory}
                onValueChange={(v) => setEditCategory(String(v))}
              >
                {CATEGORIES.map((c) => (
                  <Picker.Item key={c.value} label={c.label} value={c.value} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Unidad</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={editMeasurement}
                onValueChange={(v) => setEditMeasurement(String(v))}
              >
                {MEASUREMENTS.map((m) => (
                  <Picker.Item key={m.value} label={m.label} value={m.value} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Precio</Text>
            <TextInput
              style={styles.input}
              value={editPrice}
              onChangeText={setEditPrice}
              keyboardType="decimal-pad"
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                onPress={saveEdit}
              >
                <Text style={styles.btnText}>Guardar</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnGray]}
                onPress={cancelEdit}
              >
                <Text style={styles.btnText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 80,
    paddingBottom: 32,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#065f46", // verde oscuro
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 16,
  },
  pickerWrapper: {
    height: 70,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    overflow: "hidden",
  },
  message: {
    marginTop: 6,
    fontSize: 13,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  switchLabel: { fontSize: 13 },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  rowMain: {
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
  },
  inactiveText: {
    color: "#6b7280",
    textDecorationLine: "line-through",
  },
  meta: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  price: { marginTop: 4, fontSize: 16, fontWeight: "600" },
  rowActions: {
    flexDirection: "row",
    gap: 8,
  },
  btn: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    
  },
  btnPrimary: { backgroundColor: "#2563eb" },
  btnEdit: { backgroundColor: "#b45309" }, // amarillo oscuro
  btnGray: { backgroundColor: "#4b5563" },
  btnGreen: { backgroundColor: "#16a34a" },
  btnDanger: { backgroundColor: "#dc2626" },
  btnText: { color: "#fff", fontWeight: "700" },
  separator: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 6,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
});
