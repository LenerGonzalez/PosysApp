// src/screens/DashboardScreen.tsx
import { format } from "date-fns";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { db } from "../../services/firebase";
import { show2 } from "../../utils/number";

type Sale = {
  id: string;
  date: string;
  amount: number;
  allocations?: { lineCost: number }[];
  avgUnitCost?: number;
  quantity?: number;
};
type Expense = { id: string; date: string; amount: number };

const today = () => format(new Date(), "yyyy-MM-dd");

export default function DashboardScreen() {
  const [from, setFrom] = useState(
    format(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      "yyyy-MM-dd"
    )
  );
  const [to, setTo] = useState(today());
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    (async () => {
      // ventas
      const qs = query(
        collection(db, "salesV2"),
        where("date", ">=", from),
        where("date", "<=", to)
      );
      const sSnap = await getDocs(qs);
      const sRows: Sale[] = [];
      sSnap.forEach((d) => {
        const x = d.data() as any;
        sRows.push({
          id: d.id,
          date: x.date ?? "",
          amount: Number(x.amount ?? x.amountCharged ?? 0),
          allocations: Array.isArray(x.allocations) ? x.allocations : [],
          avgUnitCost: Number(x.avgUnitCost ?? 0),
          quantity: Number(x.quantity ?? 0),
        });
      });
      setSales(sRows);

      // gastos
      const qg = query(
        collection(db, "expenses"),
        where("date", ">=", from),
        where("date", "<=", to)
      );
      const eSnap = await getDocs(qg);
      const eRows: Expense[] = [];
      eSnap.forEach((d) => {
        const x = d.data() as any;
        eRows.push({
          id: d.id,
          date: x.date ?? "",
          amount: Number(x.amount ?? 0),
        });
      });
      setExpenses(eRows);
    })();
  }, [from, to]);

  const kpis = useMemo(() => {
    const revenue = sales.reduce((a, s) => a + (s.amount || 0), 0);
    let cogs = 0;
    sales.forEach((s) => {
      if (s.allocations?.length) {
        cogs += s.allocations.reduce(
          (acc, a) => acc + Number(a.lineCost || 0),
          0
        );
      } else if (s.avgUnitCost && s.quantity) {
        cogs += Number(s.avgUnitCost) * Number(s.quantity);
      }
    });
    const grossProfit = revenue - cogs;
    const expensesSum = expenses.reduce((a, g) => a + (g.amount || 0), 0);
    const netProfit = grossProfit - expensesSum;
    return { revenue, cogs, grossProfit, expensesSum, netProfit };
  }, [sales, expenses]);

  return (
    <View style={s.wrap}>
      <Text style={s.h1}>Finanzas</Text>

      <View style={s.row}>
        <View style={s.col}>
          <Text style={s.label}>Desde</Text>
          <TextInput style={s.input} value={from} onChangeText={setFrom} />
        </View>
        <View style={s.col}>
          <Text style={s.label}>Hasta</Text>
          <TextInput style={s.input} value={to} onChangeText={setTo} />
        </View>
      </View>

      <View style={s.kpis}>
        <Kpi title="Ventas totales" value={`C$${show2(kpis.revenue)}`} />
        <Kpi title="Costo de mercaderia" value={`C$${show2(kpis.cogs)}`} />
        <Kpi
          title="Ganancia antes de gastos"
          value={`C$${show2(kpis.grossProfit)}`}
          positive
        />
        <Kpi title="Gastos" value={`C$${show2(kpis.expensesSum)}`} />
        <Kpi
          title="Ganancia despues de gastos"
          value={`C$${show2(kpis.netProfit)}`}
          positive
        />
      </View>
    </View>
  );
}

function Kpi({
  title,
  value,
  positive,
}: {
  title: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <View style={s.kpiCard}>
      <Text style={s.kpiTitle}>{title}</Text>
      <Text style={[s.kpiValue, positive && { color: "#047857" }]}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 16,
    gap: 12,
    backgroundColor: "#fff",
    paddingTop: 100,
    marginBottom: 8,
  },
  h1: { fontSize: 22, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  col: { flex: 1 },
  label: { fontSize: 13, color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  kpiCard: {
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    padding: 12,
    width: "48%",
  },
  kpiTitle: { fontSize: 14, color: "#6B7280", marginBottom: 15 },
  kpiValue: { fontSize: 20, fontWeight: "700" },
});

// export default function TabTwoScreen() {
//   return (
//     <ParallaxScrollView
//       headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
//       headerImage={
//         <IconSymbol
//           size={310}
//           color="#808080"
//           name="chevron.left.forwardslash.chevron.right"
//           style={styles.headerImage}
//         />
//       }>
//       <ThemedView style={styles.titleContainer}>
//         <ThemedText type="title">Explore</ThemedText>
//       </ThemedView>
//       <ThemedText>This app includes example code to help you get started.</ThemedText>
//       <Collapsible title="File-based routing">
//         <ThemedText>
//           This app has two screens:{' '}
//           <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> and{' '}
//           <ThemedText type="defaultSemiBold">app/(tabs)/explore.tsx</ThemedText>
//         </ThemedText>
//         <ThemedText>
//           The layout file in <ThemedText type="defaultSemiBold">app/(tabs)/_layout.tsx</ThemedText>{' '}
//           sets up the tab navigator.
//         </ThemedText>
//         <ExternalLink href="https://docs.expo.dev/router/introduction">
//           <ThemedText type="link">Learn more</ThemedText>
//         </ExternalLink>
//       </Collapsible>
//       <Collapsible title="Android, iOS, and web support">
//         <ThemedText>
//           You can open this project on Android, iOS, and the web. To open the web version, press{' '}
//           <ThemedText type="defaultSemiBold">w</ThemedText> in the terminal running this project.
//         </ThemedText>
//       </Collapsible>
//       <Collapsible title="Images">
//         <ThemedText>
//           For static images, you can use the <ThemedText type="defaultSemiBold">@2x</ThemedText> and{' '}
//           <ThemedText type="defaultSemiBold">@3x</ThemedText> suffixes to provide files for
//           different screen densities
//         </ThemedText>
//         <Image source={require('@/assets/images/react-logo.png')} style={{ alignSelf: 'center' }} />
//         <ExternalLink href="https://reactnative.dev/docs/images">
//           <ThemedText type="link">Learn more</ThemedText>
//         </ExternalLink>
//       </Collapsible>
//       <Collapsible title="Custom fonts">
//         <ThemedText>
//           Open <ThemedText type="defaultSemiBold">app/_layout.tsx</ThemedText> to see how to load{' '}
//           <ThemedText style={{ fontFamily: 'SpaceMono' }}>
//             custom fonts such as this one.
//           </ThemedText>
//         </ThemedText>
//         <ExternalLink href="https://docs.expo.dev/versions/latest/sdk/font">
//           <ThemedText type="link">Learn more</ThemedText>
//         </ExternalLink>
//       </Collapsible>
//       <Collapsible title="Light and dark mode components">
//         <ThemedText>
//           This template has light and dark mode support. The{' '}
//           <ThemedText type="defaultSemiBold">useColorScheme()</ThemedText> hook lets you inspect
//           what the user&apos;s current color scheme is, and so you can adjust UI colors accordingly.
//         </ThemedText>
//         <ExternalLink href="https://docs.expo.dev/develop/user-interface/color-themes/">
//           <ThemedText type="link">Learn more</ThemedText>
//         </ExternalLink>
//       </Collapsible>
//       <Collapsible title="Animations">
//         <ThemedText>
//           This template includes an example of an animated component. The{' '}
//           <ThemedText type="defaultSemiBold">components/HelloWave.tsx</ThemedText> component uses
//           the powerful <ThemedText type="defaultSemiBold">react-native-reanimated</ThemedText>{' '}
//           library to create a waving hand animation.
//         </ThemedText>
//         {Platform.select({
//           ios: (
//             <ThemedText>
//               The <ThemedText type="defaultSemiBold">components/ParallaxScrollView.tsx</ThemedText>{' '}
//               component provides a parallax effect for the header image.
//             </ThemedText>
//           ),
//         })}
//       </Collapsible>
//     </ParallaxScrollView>
//   );
// }

// const styles = StyleSheet.create({
//   headerImage: {
//     color: '#808080',
//     bottom: -90,
//     left: -35,
//     position: 'absolute',
//   },
//   titleContainer: {
//     flexDirection: 'row',
//     gap: 8,
//   },
// });
