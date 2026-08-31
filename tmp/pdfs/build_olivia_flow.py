from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = "output/pdf/fluxo-atendimento-olivia.pdf"

GREEN = colors.HexColor("#5F7D67")
GOLD = colors.HexColor("#B8893C")
CREAM = colors.HexColor("#F4EFEA")
DARK = colors.HexColor("#2F2F2F")
GRAY = colors.HexColor("#6B6B6B")
LIGHT_GREEN = colors.HexColor("#E7EEE8")
LIGHT_GOLD = colors.HexColor("#F7F0E3")
LINE = colors.HexColor("#DED7D0")


def p(text, style):
    return Paragraph(text, style)


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="TitleOli", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=23, leading=28, textColor=GREEN, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="SubtitleOli", parent=styles["Normal"], fontName="Helvetica",
    fontSize=10.5, leading=15, textColor=GRAY, spaceAfter=16,
))
styles.add(ParagraphStyle(
    name="SectionOli", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=14, leading=18, textColor=DARK, spaceBefore=10, spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="BodyOli", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9.4, leading=13.2, textColor=DARK, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="SmallOli", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8.3, leading=11.2, textColor=DARK,
))
styles.add(ParagraphStyle(
    name="MessageOli", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9.1, leading=13.2, textColor=DARK,
))
styles.add(ParagraphStyle(
    name="LabelOli", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=8.2, leading=10, textColor=GREEN, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="FooterOli", parent=styles["Normal"], fontName="Helvetica",
    fontSize=7.5, textColor=GRAY, alignment=TA_CENTER,
))


def message_box(label, text, tone="green"):
    background = LIGHT_GREEN if tone == "green" else LIGHT_GOLD
    accent = GREEN if tone == "green" else GOLD
    table = Table([[p(label, styles["LabelOli"])], [p(text, styles["MessageOli"])]], colWidths=[16.5 * cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BOX", (0, 0), (-1, -1), 0.8, accent),
        ("LINEBEFORE", (0, 0), (0, -1), 4, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def bullet_list(items):
    return [p(f"<b>•</b> {item}", styles["BodyOli"]) for item in items]


def page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(1.8 * cm, 1.35 * cm, A4[0] - 1.8 * cm, 1.35 * cm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GRAY)
    canvas.drawString(1.8 * cm, 0.85 * cm, "OLI Health Hub | Fluxo comercial da Olivia")
    canvas.drawRightString(A4[0] - 1.8 * cm, 0.85 * cm, f"Página {doc.page}")
    canvas.restoreState()


doc = BaseDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=1.8 * cm,
    rightMargin=1.8 * cm,
    topMargin=1.55 * cm,
    bottomMargin=1.75 * cm,
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
doc.addPageTemplates([__import__("reportlab.platypus", fromlist=["PageTemplate"]).PageTemplate(id="oli", frames=[frame], onPage=page)])

story = []
story += [
    p("Fluxo comercial da Olivia", styles["TitleOli"]),
    p("WhatsApp | Primeiro contato, qualificação, objeções e próximos passos", styles["SubtitleOli"]),
    message_box("PRINCÍPIO", "Uma mensagem por vez. A Olivia responde ao que a pessoa trouxe, faz no máximo uma pergunta e conduz para o próximo passo sem pressionar.", "gold"),
    Spacer(1, 12),
    p("1. Ponto de partida", styles["SectionOli"]),
    p("A equipe faz a primeira abordagem humana. Quando o lead responde, a Olivia assume a conversa e segue o caminho que corresponde à necessidade declarada.", styles["BodyOli"]),
    message_box("MENSAGEM INICIAL DA EQUIPE", "Olá, {primeiroNome}! Aqui é o Guilherme, do OLI Health Hub. Recebi seu contato pelo formulário sobre nossos consultórios. Você procura um espaço para atendimentos pontuais ou recorrentes?"),
    Spacer(1, 12),
    p("2. Duas saídas principais", styles["SectionOli"]),
]

flow_data = [
    [p("SE O LEAD DIZ: PONTUAIS", styles["LabelOli"]), p("SE O LEAD DIZ: RECORRENTES", styles["LabelOli"])],
    [p("Para uma rotina mais flexível, o START costuma encaixar melhor: sem mensalidade e R$ 1,90 por minuto. Você compra horas, reserva a partir de 30 minutos e usa o saldo conforme a agenda.<br/><br/><b>Qual é a sua especialidade?</b>", styles["MessageOli"]),
     p("Para uma agenda mais recorrente, o PRO pode ser mais adequado: R$ 599/mês, ou R$ 499/mês com fidelidade de 6 meses, mais R$ 1,45 por minuto. Inclui prontuário e agenda pela internet, emissão de nota fiscal e apoio da recepção.<br/><br/><b>Qual é a sua especialidade?</b>", styles["MessageOli"])]
]
flow_table = Table(flow_data, colWidths=[8.1 * cm, 8.1 * cm])
flow_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, 0), LIGHT_GREEN),
    ("BACKGROUND", (1, 0), (1, 0), LIGHT_GOLD),
    ("BACKGROUND", (0, 1), (-1, -1), colors.white),
    ("BOX", (0, 0), (-1, -1), 0.7, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.7, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("TOPPADDING", (0, 0), (-1, -1), 9),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
]))
story += [flow_table, Spacer(1, 12)]
story += [
    p("3. Depois da especialidade", styles["SectionOli"]),
    message_box("PRÓXIMA MENSAGEM DA OLIVIA", "Temos salas preparadas para esse tipo de atendimento. Você prefere receber uma foto do espaço ou agendar uma visita para conhecer pessoalmente?"),
    p("Se escolher visita, enviar: <font color='#5F7D67'>https://calendly.com/olihealthhub/atendimento-presencial</font>. Se escolher foto, enviar somente uma imagem real e adequada à especialidade.", styles["SmallOli"]),
]

story += [PageBreak(), p("Objeções e perguntas frequentes", styles["TitleOli"]), p("Respostas curtas. Sem calcular valores novos, negociar desconto ou inventar condições.", styles["SubtitleOli"])]

scenarios = [
    ("“Achei caro.”", "Faz sentido avaliar o custo. Em uma sessão de 50 minutos, o START sai por R$ 95 e o PRO por R$ 72,50. A diferença é não ter um custo fixo de consultório nos dias em que não atende. Quer conhecer o espaço para avaliar se funciona para a sua rotina?"),
    ("“Já tenho consultório.”", "O OLI pode funcionar como uma opção complementar, sem custo parado quando você não precisar usar. Em quais situações você sente falta de uma sala extra?"),
    ("“Preciso só para uma vez.”", "Sem problema. O START não tem mensalidade e foi pensado justamente para uma rotina mais flexível. Qual é a sua especialidade?"),
    ("“Quanto vou gastar por mês?”", "Para passar um valor mensal certinho, a equipe confirma conforme a sua rotina de atendimentos. Hoje você busca usar o espaço de forma pontual ou recorrente?"),
    ("“Como funcionam as horas?”", "As horas são compradas em blocos de uma hora. Você pode reservar a partir de 30 minutos, e o saldo é consumido por minuto durante o atendimento. Ficou alguma dúvida sobre a reserva?"),
    ("“Tem sala para minha especialidade?”", "Temos salas preparadas para diferentes tipos de atendimento. Qual é a sua especialidade para eu indicar a opção mais adequada?"),
    ("“Quero ver fotos.”", "Claro. Qual é a sua especialidade? Assim envio uma foto real de uma sala que faça sentido para o seu atendimento."),
    ("“Quero falar com alguém.”", "Claro. Vou conectar você com a equipe do OLI para continuarmos por aqui."),
    ("“Quero desconto / condição especial.”", "Vou pedir para a equipe confirmar as condições disponíveis para você. Ela continua o atendimento por aqui."),
]

for title, response in scenarios:
    story.append(KeepTogether([
        p(title, styles["LabelOli"]),
        message_box("RESPOSTA SUGERIDA", response, "green"),
        Spacer(1, 7),
    ]))

story += [p("Guia rápido de condução", styles["TitleOli"]), p("Use este roteiro como direção, não como texto para copiar e repetir em todas as conversas.", styles["SubtitleOli"])]
story += [
    p("O que fazer", styles["SectionOli"]),
]
story += bullet_list([
    "Responder primeiro à pergunta ou à informação que o lead trouxe.",
    "Fazer somente uma pergunta que ajude a definir o próximo passo.",
    "Usar a especialidade para oferecer foto real ou visita ao espaço.",
    "Conduzir para a visita de forma leve quando fizer sentido.",
    "Transferir imediatamente se o lead pedir humano, negociar preço, reclamar ou trouxer assunto fora do escopo.",
])
story += [p("O que evitar", styles["SectionOli"])]
story += bullet_list([
    "Explicar START e PRO juntos quando a pessoa já disse que busca uma rotina pontual ou recorrente.",
    "Repetir perguntas já respondidas ou resumir o que a pessoa acabou de dizer.",
    "Calcular custo mensal, semanal ou por volume de pacientes. A equipe confirma valores personalizados.",
    "Prometer horário, desconto, prazo, disponibilidade ou condição não confirmada.",
    "Enviar mais de uma foto por vez ou inventar links de imagem.",
])
story += [Spacer(1, 8), message_box("LEMBRETE", "A Olivia atende leads comerciais. Pacientes, cobrança, dados sensíveis e assuntos fora do escopo devem ser transferidos para uma pessoa da equipe.", "gold")]

doc.build(story)
