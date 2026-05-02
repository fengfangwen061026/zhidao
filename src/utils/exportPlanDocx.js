import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';

const COLORS = {
  primary: '4338CA',
  teacher: '3730A3',
  child: 'DB2777',
  summary: '047857',
  section: '1E293B',
  muted: '64748B',
};

const FONT = '微软雅黑';

function text(content, opts = {}) {
  return new TextRun({ text: content, font: FONT, size: 24, ...opts });
}

function heading(content, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 300, after: 120 },
    children: [text(content, { bold: true, size: level === HeadingLevel.HEADING_1 ? 36 : 28 })],
  });
}

function sectionTitle(label) {
  return heading(label, HeadingLevel.HEADING_2);
}

function bodyPara(content, opts = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    indent: opts.indent ? { left: 480 } : undefined,
    children: [text(content, opts)],
  });
}

function bulletItem(content) {
  return new Paragraph({
    spacing: { after: 60 },
    indent: { left: 480, hanging: 240 },
    children: [
      text('• ', { bold: true }),
      text(content),
    ],
  });
}

function buildProcessLines(step, stepIdx) {
  const cleaned = step.replace(/^\d+[.、]\s*/, '');
  const lines = cleaned.split('\n').filter((l) => l.trim());
  const paragraphs = [];

  paragraphs.push(new Paragraph({
    spacing: { before: 240, after: 100 },
    children: [text(`${stepIdx + 1}. `, { bold: true, size: 26 }), text(lines[0] || '', { bold: true, size: 26 })],
  }));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    let run;
    if (line.match(/^师[：:]/)) {
      run = text(line, { color: COLORS.teacher, bold: true });
    } else if (line.match(/^幼[：:]/)) {
      run = text(line, { color: COLORS.child, italics: true });
    } else if (line.match(/^小结[：:]/)) {
      run = text(line, { color: COLORS.summary, bold: true });
    } else {
      run = text(line);
    }
    paragraphs.push(new Paragraph({
      spacing: { after: 40 },
      indent: { left: 480 },
      children: [run],
    }));
  }

  return paragraphs;
}

function infoTable(plan) {
  const rows = [];
  const pairs = [];
  if (plan.title) pairs.push(['活动名称', plan.title]);
  if (plan.age_group) pairs.push(['适用年龄', plan.age_group]);

  if (pairs.length === 0) return [];

  for (const [label, value] of pairs) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2000, type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: 'EEF2FF' },
            children: [new Paragraph({ children: [text(label, { bold: true, color: COLORS.primary })] })],
          }),
          new TableCell({
            width: { size: 7600, type: WidthType.DXA },
            children: [new Paragraph({ children: [text(value)] })],
          }),
        ],
      }),
    );
  }

  return [
    new Table({
      rows,
      width: { size: 9600, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      },
    }),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
  ];
}

export default async function exportPlanDocx(plan) {
  const p = plan;
  const children = [];

  children.push(heading(p.title || '幼儿园教学活动方案'));

  children.push(...infoTable(p));

  if (p.goals?.length) {
    children.push(sectionTitle('一、活动目标'));
    p.goals.forEach((g) => children.push(bulletItem(g)));
  }

  if (p.preparation?.length) {
    children.push(sectionTitle('二、活动准备'));
    p.preparation.forEach((pp) => children.push(bodyPara(`- ${pp}`, { indent: true })));
  }

  if (p.process?.length) {
    children.push(sectionTitle('三、活动过程'));
    p.process.forEach((step, i) => {
      children.push(...buildProcessLines(step, i));
    });
  }

  if (p.extension) {
    children.push(sectionTitle('四、活动延伸'));
    const ext = typeof p.extension === 'string' ? p.extension : p.extension?.join?.('\n') || '';
    ext.split('\n').filter((l) => l.trim()).forEach((line) => {
      children.push(bodyPara(line, { indent: true }));
    });
  }

  if (p.reflection_points?.length) {
    children.push(sectionTitle('五、活动反思要点'));
    p.reflection_points.forEach((rp) => children.push(bulletItem(rp)));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${(p.title || '活动教案').replace(/[\\/:*?"<>|]/g, '_')}.docx`;
  saveAs(blob, filename);
}
