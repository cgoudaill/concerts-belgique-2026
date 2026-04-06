const { list } = require('@vercel/blob');
const ExcelJS = require('exceljs');

async function readConcerts() {
  const { blobs } = await list({ prefix: 'concerts-belgique-2026' });
  if (!blobs.length) return [];
  const res = await fetch(blobs[0].url + '?t=' + Date.now());
  return res.json();
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/* Genre colour fills */
const GENRE_FILLS = {
  'Rock':       { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } },
  'Folk / Alt': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } },
  'Classique':  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } },
  'Opéra':      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } },
};

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const concerts = await readConcerts();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Agenda Concerts Belgique';
    wb.created = new Date();

    const ws = wb.addWorksheet('Concerts Belgique 2026', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    /* Columns */
    ws.columns = [
      { header: 'Date',        key: 'date',      width: 14 },
      { header: 'Artiste',     key: 'artist',    width: 48 },
      { header: 'Salle',       key: 'venue',     width: 36 },
      { header: 'Ville',       key: 'city',      width: 22 },
      { header: 'Genre',       key: 'genre',     width: 16 },
      { header: 'Réservation', key: 'ticketUrl', width: 50 },
    ];

    /* Header row style */
    const headerRow = ws.getRow(1);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1714' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF444444' } },
      };
    });
    headerRow.height = 22;

    /* Data rows */
    concerts.forEach((c, i) => {
      const row = ws.addRow({
        date:      c.date,
        artist:    c.artist,
        venue:     c.venue,
        city:      c.city,
        genre:     c.genre,
        ticketUrl: c.ticketUrl || '',
      });
      row.height = 18;

      // Rendre ticketUrl cliquable
      if (c.ticketUrl) {
        const cell = row.getCell('ticketUrl');
        cell.value = { text: 'Réserver', hyperlink: c.ticketUrl };
        cell.font = { color: { argb: 'FF1A4D9E' }, underline: true };
      }

      const fill = GENRE_FILLS[c.genre];
      if (fill) {
        row.eachCell(cell => {
          cell.fill = fill;
          cell.alignment = { vertical: 'middle' };
        });
      }

      /* Alternate row for readability when no genre colour */
      if (!fill && i % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        });
      }
    });

    /* Auto-filter */
    ws.autoFilter = { from: 'A1', to: 'E1' };

    /* Totals row */
    const totalRow = ws.addRow(['', `Total : ${concerts.length} concerts`, '', '', '']);
    totalRow.getCell(2).font = { italic: true, color: { argb: 'FF666666' } };
    totalRow.getCell(2).alignment = { horizontal: 'left' };

    const buffer = await wb.xlsx.writeBuffer();

    const filename = `concerts-belgique-${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
