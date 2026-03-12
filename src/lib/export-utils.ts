/**
 * Export utilities for IPv6 Calculator
 */

interface IPData {
  number: number;
  ip: string;
}

function downloadFile(content: string | ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function getCurrentDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function exportToCSV(data: IPData[], filename = 'ips_ipv6') {
  if (!data || data.length === 0) return;
  const headers = ['Número', 'Endereço IPv6'];
  const csvContent = [
    headers.join(','),
    ...data.map(item => [item.number || '', `"${item.ip || ''}"`].join(',')),
  ].join('\n');
  downloadFile(csvContent, `${filename}_${getCurrentDateString()}.csv`, 'text/csv');
}

export function exportToTXT(data: IPData[], filename = 'ips_ipv6') {
  if (!data || data.length === 0) return;
  const txtContent = [
    '# Lista de Endereços IPv6',
    `# Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `# Total de IPs: ${data.length}`,
    '',
    ...data.map(item => item.ip || ''),
  ].join('\n');
  downloadFile(txtContent, `${filename}_${getCurrentDateString()}.txt`, 'text/plain');
}

export function exportToJSON(data: IPData[], filename = 'ips_ipv6', metadata: Record<string, unknown> = {}) {
  if (!data || data.length === 0) return;
  const jsonData = {
    metadata: {
      generated_at: new Date().toISOString(),
      generated_by: 'Calculadora IPv6',
      total_ips: data.length,
      ...metadata,
    },
    ips: data,
  };
  downloadFile(JSON.stringify(jsonData, null, 2), `${filename}_${getCurrentDateString()}.json`, 'application/json');
}

export async function exportToExcel(data: IPData[], filename = 'ips_ipv6') {
  if (!data || data.length === 0) return;
  const XLSX = await import('xlsx');
  const excelData = data.map(item => ({
    'Número': item.number || '',
    'Endereço IPv6': item.ip || '',
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);
  ws['!cols'] = [{ width: 10 }, { width: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, 'IPs IPv6');
  XLSX.writeFile(wb, `${filename}_${getCurrentDateString()}.xlsx`);
}

export function exportSubnetsToCSV(subnets: { subnet: string; initial: string; final: string; network: string }[], filename = 'subredes_ipv6') {
  if (!subnets || subnets.length === 0) return;
  const headers = ['Sub-rede', 'Inicial', 'Final', 'Rede'];
  const csvContent = [
    headers.join(','),
    ...subnets.map(s => [s.subnet, s.initial, s.final, s.network].map(v => `"${v}"`).join(',')),
  ].join('\n');
  downloadFile(csvContent, `${filename}_${getCurrentDateString()}.csv`, 'text/csv');
}
