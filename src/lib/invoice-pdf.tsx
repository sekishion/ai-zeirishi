/**
 * 請求書PDF生成（適格請求書対応）
 *
 * サーバーサイドで @react-pdf/renderer を使って PDF Buffer を生成。
 * クライアントでも PDFDownloadLink に同じ Document を渡せる設計。
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';

// 日本語フォント登録（NEXT_PUBLIC_APP_URL必須。未設定だと日本語が表示されない）
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
if (!APP_URL) {
  console.error('[invoice-pdf] NEXT_PUBLIC_APP_URL is not set. PDF Japanese fonts will not load.');
}
Font.register({
  family: 'NotoSansJP',
  src: APP_URL ? `${APP_URL}/fonts/NotoSansJP-Regular.ttf` : '/fonts/NotoSansJP-Regular.ttf',
});

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'NotoSansJP', fontSize: 10, color: '#1A2331' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 8, color: '#999', marginBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  meta: { fontSize: 9, color: '#666', marginBottom: 2 },
  sectionTitle: { fontSize: 8, color: '#999', letterSpacing: 1, marginBottom: 4 },
  clientName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  companyName: { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  regNumber: { fontSize: 9, fontWeight: 'bold', marginBottom: 2 },
  regWarning: { fontSize: 8, color: '#d97706' },
  totalBox: { backgroundColor: '#F0F7F4', padding: 16, borderRadius: 6, textAlign: 'center', marginVertical: 16, border: '1 solid #C7E5D1' },
  totalLabel: { fontSize: 9, color: '#3A6B4F', marginBottom: 4 },
  totalAmount: { fontSize: 28, fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F8F9FB', borderBottomWidth: 1.5, borderBottomColor: '#D8DEE6', paddingVertical: 6, paddingHorizontal: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#eee', paddingVertical: 6, paddingHorizontal: 4 },
  th: { fontSize: 8, color: '#666', fontWeight: 'bold' },
  td: { fontSize: 9 },
  tdRight: { fontSize: 9, textAlign: 'right' },
  tdCenter: { fontSize: 8, textAlign: 'center', color: '#666' },
  col1: { flex: 3 },
  col2: { width: 40, textAlign: 'right' },
  col3: { width: 70, textAlign: 'right' },
  col4: { width: 40, textAlign: 'center' },
  col5: { width: 80, textAlign: 'right' },
  separator: { borderBottomWidth: 0.5, borderBottomColor: '#D8DEE6', marginVertical: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'flex-end', marginVertical: 2 },
  summaryLabel: { fontSize: 9, color: '#666', width: 120, textAlign: 'right', marginRight: 8 },
  summaryValue: { fontSize: 9, width: 80, textAlign: 'right' },
  grandTotal: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1.5, borderTopColor: '#1A2331', paddingTop: 8, marginTop: 4 },
  grandTotalLabel: { fontSize: 12, fontWeight: 'bold', width: 200, textAlign: 'right', marginRight: 8 },
  grandTotalValue: { fontSize: 14, fontWeight: 'bold', width: 80, textAlign: 'right' },
  bankBox: { backgroundColor: '#F8F9FB', padding: 12, borderRadius: 6, marginTop: 16 },
  bankLabel: { fontSize: 8, color: '#999', marginBottom: 4 },
  bankText: { fontSize: 9, lineHeight: 1.6 },
  memoBox: { backgroundColor: '#FEFCE8', padding: 12, borderRadius: 6, marginTop: 8 },
  footer: { textAlign: 'center', fontSize: 7, color: '#999', marginTop: 20 },
  reducedNote: { fontSize: 8, color: '#d97706', marginTop: 4 },
  amber: { color: '#d97706' },
});

export interface InvoicePdfData {
  id: string;
  client: string;
  clientPostalCode?: string;
  clientAddress?: string;
  clientRegistrationNumber?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    taxRate: 8 | 10;
  }>;
  subtotal: number;
  subtotal10: number;
  subtotal8: number;
  tax: number;
  tax10: number;
  tax8: number;
  total: number;
  issueDate: string;
  dueDate: string;
  companyName: string;
  companyPostalCode?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyRepresentative?: string;
  registrationNumber?: string;
  bankAccount?: string;
  memo?: string;
}

function yen(n: number) { return `¥${n.toLocaleString()}`; }

export function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  const has8 = data.subtotal8 > 0;
  const has10 = data.subtotal10 > 0;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ヘッダー */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>請求書</Text>
            <Text style={s.subtitle}>INVOICE</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.meta}>請求書番号: {data.id}</Text>
            <Text style={s.meta}>発行日: {data.issueDate}</Text>
            <Text style={[s.meta, { fontWeight: 'bold', color: '#1A2331' }]}>支払期限: {data.dueDate}</Text>
          </View>
        </View>

        {/* 取引先 + 発行元 */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.sectionTitle}>請求先 / BILL TO</Text>
            <Text style={s.clientName}>{data.client} 御中</Text>
            {data.clientAddress && (
              <Text style={s.meta}>
                {data.clientPostalCode ? `〒${data.clientPostalCode} ` : ''}{data.clientAddress}
              </Text>
            )}
            {data.clientRegistrationNumber && (
              <Text style={[s.meta, { fontFamily: 'Courier' }]}>登録番号: {data.clientRegistrationNumber}</Text>
            )}
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={s.sectionTitle}>発行元 / FROM</Text>
            <Text style={s.companyName}>{data.companyName}</Text>
            {data.companyRepresentative && <Text style={s.meta}>代表 {data.companyRepresentative}</Text>}
            {data.companyAddress && (
              <Text style={s.meta}>
                {data.companyPostalCode ? `〒${data.companyPostalCode} ` : ''}{data.companyAddress}
              </Text>
            )}
            {data.companyPhone && <Text style={s.meta}>TEL: {data.companyPhone}</Text>}
            {data.registrationNumber
              ? <Text style={s.regNumber}>登録番号: {data.registrationNumber}</Text>
              : <Text style={s.regWarning}>インボイス登録番号 未設定</Text>}
          </View>
        </View>

        {/* 合計 */}
        <View style={s.totalBox}>
          <Text style={s.totalLabel}>ご請求金額（税込）</Text>
          <Text style={s.totalAmount}>{yen(data.total)}</Text>
        </View>

        {/* 品目テーブル */}
        <View style={s.tableHeader}>
          <Text style={[s.th, s.col1]}>品目 / 摘要</Text>
          <Text style={[s.th, s.col2]}>数量</Text>
          <Text style={[s.th, s.col3]}>単価</Text>
          <Text style={[s.th, s.col4]}>税率</Text>
          <Text style={[s.th, s.col5]}>金額</Text>
        </View>
        {data.items.map((item, i) => (
          <View key={i} style={s.tableRow}>
            <Text style={[s.td, s.col1]}>
              {item.taxRate === 8 ? '※ ' : ''}{item.name}
            </Text>
            <Text style={[s.tdRight, s.col2]}>{item.quantity}</Text>
            <Text style={[s.tdRight, s.col3]}>{yen(item.unitPrice)}</Text>
            <Text style={[s.tdCenter, s.col4]}>
              {item.taxRate}%{item.taxRate === 8 ? '※' : ''}
            </Text>
            <Text style={[s.tdRight, s.col5]}>{yen(item.unitPrice * item.quantity)}</Text>
          </View>
        ))}

        {has8 && <Text style={s.reducedNote}>※ は軽減税率（8%）対象品目</Text>}

        <View style={s.separator} />

        {/* 税率内訳 */}
        {has10 && (
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>10%対象 計</Text>
            <Text style={s.summaryValue}>{yen(data.subtotal10)}</Text>
            <Text style={[s.summaryLabel, { width: 80 }]}>消費税</Text>
            <Text style={s.summaryValue}>{yen(data.tax10)}</Text>
          </View>
        )}
        {has8 && (
          <View style={s.summaryRow}>
            <Text style={[s.summaryLabel, s.amber]}>8%対象※ 計</Text>
            <Text style={[s.summaryValue, s.amber]}>{yen(data.subtotal8)}</Text>
            <Text style={[s.summaryLabel, s.amber, { width: 80 }]}>消費税</Text>
            <Text style={[s.summaryValue, s.amber]}>{yen(data.tax8)}</Text>
          </View>
        )}

        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>小計</Text>
          <Text style={s.summaryValue}>{yen(data.subtotal)}</Text>
          <Text style={[s.summaryLabel, { width: 80 }]}>消費税合計</Text>
          <Text style={s.summaryValue}>{yen(data.tax)}</Text>
        </View>

        <View style={s.grandTotal}>
          <Text style={s.grandTotalLabel}>合計（税込）</Text>
          <Text style={s.grandTotalValue}>{yen(data.total)}</Text>
        </View>

        {/* 振込先 */}
        {data.bankAccount && (
          <View style={s.bankBox}>
            <Text style={s.bankLabel}>振込先</Text>
            <Text style={s.bankText}>{data.bankAccount}</Text>
          </View>
        )}

        {/* 備考 */}
        {data.memo && (
          <View style={s.memoBox}>
            <Text style={s.bankLabel}>備考</Text>
            <Text style={s.bankText}>{data.memo}</Text>
          </View>
        )}

        <Text style={s.footer}>この請求書は適格請求書（インボイス制度）に対応しています</Text>
      </Page>
    </Document>
  );
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const buffer = await renderToBuffer(<InvoicePdfDocument data={data} />);
  return Buffer.from(buffer);
}
