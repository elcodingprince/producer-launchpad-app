import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
  },
  headerSegment: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 20,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
  },
  headerRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  detailsText: {
    fontSize: 10,
    marginBottom: 4,
    color: '#333333',
  },
  bold: {
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  paragraph: {
    fontSize: 11,
    lineHeight: 1.5,
    marginBottom: 10,
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    padding: 10,
  },
  tableRowLast: {
    display: 'flex',
    flexDirection: 'row',
    padding: 10,
  },
  tableColHeader: {
    width: '50%',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666666',
  },
  tableCol: {
    width: '50%',
    fontSize: 10,
  },
  signatureSection: {
    marginTop: 50,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBlock: {
    width: '45%',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginBottom: 5,
    height: 30,
  },
  signatureText: {
    fontSize: 10,
  },
});

export interface LicenseTemplateProps {
  licenseName: string;
  producerName: string;
  customerName: string;
  beatTitle: string;
  date: string;
  orderNumber: string;
  streamLimit: number;
  copyLimit: number;
  termYears: number;
  includesStems: boolean;
  term1?: string;
  term2?: string;
}

export function BasicLicenseTemplate({
  licenseName,
  producerName,
  customerName,
  beatTitle,
  date,
  orderNumber,
  streamLimit,
  copyLimit,
  termYears,
  includesStems,
  term1,
  term2,
}: LicenseTemplateProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header */}
        <View style={styles.headerSegment}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>{licenseName}</Text>
            <Text style={styles.subtitle}>Beat Licensing Agreement</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.detailsText}>Order: #{orderNumber}</Text>
            <Text style={styles.detailsText}>Date: {date}</Text>
          </View>
        </View>

        {/* Intro */}
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            This agreement is securely generated and represents a legally binding contract between <Text style={styles.bold}>{producerName}</Text> ("Licensor") and <Text style={styles.bold}>{customerName}</Text> ("Licensee").
          </Text>
          <Text style={styles.paragraph}>
            The Licensor grants the Licensee the right to use the instrumental track titled <Text style={styles.bold}>"{beatTitle}"</Text> subject to the following terms and restrictions.
          </Text>
        </View>

        {/* Dynamic Limits Table */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColHeader}>Audio Streams Limit</Text>
            <Text style={styles.tableCol}>{streamLimit === 0 ? "Unlimited" : streamLimit.toLocaleString()} Streams</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColHeader}>Physical/Digital Copies</Text>
            <Text style={styles.tableCol}>{copyLimit === 0 ? "Unlimited" : copyLimit.toLocaleString()} Copies</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColHeader}>Contract Term</Text>
            <Text style={styles.tableCol}>{termYears === 0 ? "Perpetual (No Expiration)" : `${termYears} Years`}</Text>
          </View>
          <View style={styles.tableRowLast}>
            <Text style={styles.tableColHeader}>Includes Trackout/Stems</Text>
            <Text style={styles.tableCol}>{includesStems ? "Yes" : "No"}</Text>
          </View>
        </View>

        {/* Dynamic Terms from Metaobjects */}
        {(term1 || term2) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Custom Terms</Text>
            {term1 && <Text style={styles.paragraph}>1. {term1}</Text>}
            {term2 && <Text style={styles.paragraph}>2. {term2}</Text>}
          </View>
        )}

        {/* Standard Boilerplate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Terms</Text>
          <Text style={styles.paragraph}>
            • The Licensee may not resell, lease, or sub-license the instrumental track, either in whole or in part, to any other party.
          </Text>
          <Text style={styles.paragraph}>
            • The Licensor retains full copyright ownership of the instrumental track. Appropriate credit must be given to the Licensor in all written and digital distributions (e.g., "Produced by {producerName}").
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Licensor: {producerName}</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Licensee: {customerName}</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
