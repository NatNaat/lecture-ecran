#!/usr/bin/env python3
"""Génère Portier.shortcut (non signé) puis le signe avec l'outil `shortcuts` de macOS.

Usage : python3 build.py        → Portier.shortcut prêt à importer (AirDrop / iCloud Drive vers l'iPhone)
Le raccourci reçoit en entrée le nom de l'appli (« TikTok ») ou « fermeture TikTok ».
"""
import plistlib, re, subprocess, sys, uuid
from pathlib import Path

HERE = Path(__file__).parent
# L'adresse et la clé anon (publiques) sont reprises de config.js : il ne reste que le secret à coller sur l'iPhone.
_cfg = (HERE.parent / "config.js").read_text() if (HERE.parent / "config.js").exists() else ""
URL = (re.search(r'supabaseUrl:\s*"([^"]+)"', _cfg) or [None, "https://XXXX.supabase.co"])[1]
KEY = (re.search(r'supabaseAnonKey:\s*"([^"]+)"', _cfg) or [None, "COLLE_ICI_LA_CLE_ANON"])[1]
OBJ = "￼"  # caractère de remplacement où s'insère une variable


def uid(): return str(uuid.uuid4()).upper()

def var(name, key=None):
    a = {"Type": "Variable", "VariableName": name}
    if key:
        a["Aggrandizements"] = [
            {"Type": "WFCoercionVariableAggrandizement", "CoercionItemClass": "WFDictionaryContentItem"},
            {"Type": "WFDictionaryValueVariableAggrandizement", "DictionaryKey": key}]
    return a

INPUT = {"Type": "ExtensionInput"}

def att(a): return {"Value": a, "WFSerializationType": "WFTextTokenAttachment"}

def text(*parts):
    """text("abc", var("X"), "def") → chaîne avec variables insérées."""
    s, ranges = "", {}
    for p in parts:
        if isinstance(p, str): s += p
        else: ranges["{%d, 1}" % len(s)] = p; s += OBJ
    return {"Value": {"string": s, "attachmentsByRange": ranges}, "WFSerializationType": "WFTextTokenString"}

def dico(items):
    return {"Value": {"WFDictionaryFieldValueItems": [
        {"WFItemType": 0, "WFKey": text(k), "WFValue": v if isinstance(v, dict) else text(v)} for k, v in items.items()]},
        "WFSerializationType": "WFDictionaryFieldValue"}

def action(ident, **params): return {"WFWorkflowActionIdentifier": "is.workflow.actions." + ident, "WFWorkflowActionParameters": params}

def set_var(name, source): return action("setvariable", WFVariableName=name, WFInput=att(source))

def out(u, name): return {"Type": "ActionOutput", "OutputUUID": u, "OutputName": name}

def rpc(fn, body, into):
    """POST {url}/rest/v1/rpc/<fn> ; la réponse JSON est rangée dans la variable `into`."""
    u = uid()
    return [action("downloadurl", UUID=u, WFURL=text(var("Cfg", "url"), "/rest/v1/rpc/" + fn), WFHTTPMethod="POST",
                   WFHTTPBodyType="JSON", ShowHeaders=True,
                   WFHTTPHeaders=dico({"apikey": text(var("Cfg", "cle")), "Content-Type": "application/json"}),
                   WFJSONValues=dico({"p_secret": text(var("Cfg", "secret")), **body})),
            set_var(into, out(u, "Contenu de l'URL"))]

def if_(source, cond, value=None):
    g = uid()
    p = dict(GroupingIdentifier=g, WFControlFlowMode=0, WFCondition=cond, WFInput={"Type": "Variable", "Variable": att(source)})
    if value is not None: p["WFConditionalActionString"] = value
    return g, action("conditional", **p)

def if_text(source, cond, value):
    """Condition sur du texte : on passe d'abord la valeur dans un bloc Texte, sinon iOS ne connaît pas
    son type (entrée du raccourci, champ d'un dictionnaire) et refuse « est » / « contient » à l'import."""
    u = uid()
    g, c = if_(out(u, "Texte"), cond, value)
    return g, [action("gettext", UUID=u, WFTextActionText=text(source)), c]

def end_if(g): return action("conditional", GroupingIdentifier=g, WFControlFlowMode=2)
def alert(title, msg): return action("alert", WFAlertActionTitle=title, WFAlertActionMessage=msg, WFAlertActionCancelButtonShown=False)
def ask(prompt, kind, u): return action("ask", UUID=u, WFAskActionPrompt=prompt, WFInputType=kind)

IS, CONTAINS, HAS_VALUE, NO_VALUE = 4, 99, 100, 101
EXIT, HOME = action("exit"), action("returntohomescreen")


def portier():
    a = []
    # ── Réglages : les trois valeurs affichées dans la web app › Réglages ──
    cfg = uid()
    a += [action("comment", WFCommentActionText="RÉGLAGES — colle ton secret (web app › Réglages) à la place de COLLE_ICI_LE_SECRET. url et cle sont déjà remplies."),
          action("dictionary", UUID=cfg, WFItems=dico({"url": URL, "cle": KEY, "secret": "COLLE_ICI_LE_SECRET"})),
          set_var("Cfg", out(cfg, "Dictionnaire"))]

    # ── Fermeture d'une appli : on prévient le serveur et c'est tout ──
    g, cond = if_text(INPUT, CONTAINS, "fermeture")
    a += [*cond, *rpc("close_session", {"p_app": text(INPUT)}, "R"), EXIT, end_if(g)]

    # ── Pas de réseau : bloqué ──
    ip = uid()
    a += [action("getipaddress", UUID=ip, WFIPAddressSourceOption="Local")]
    g, cond = if_(out(ip, "Adresse IP actuelle"), NO_VALUE)
    a += [cond, HOME, alert("Bloqué", "Pas de réseau : impossible de vérifier ton solde."), EXIT, end_if(g)]

    # ── Session en cours ? On laisse passer ──
    a += rpc("gate_status", {"p_app": text(INPUT)}, "Etat")
    g, cond = if_text(var("Etat", "state"), IS, "open")
    a += [*cond, EXIT, end_if(g)]

    # ── Sinon : dehors, puis le choix ──
    a += [HOME]
    m = uid()
    a += [action("choosefrommenu", GroupingIdentifier=m, WFControlFlowMode=0, WFMenuPrompt=text(var("Etat", "prompt")),
                 WFMenuItems=["J'ai lu", "Utiliser mon solde", "Annuler"])]

    a += [action("choosefrommenu", GroupingIdentifier=m, WFControlFlowMode=1, WFMenuItemTitle="J'ai lu")]
    livre, page, resume = uid(), uid(), uid()
    a += [action("choosefromlist", UUID=livre, WFInput=att(var("Etat", "books")), WFChooseFromListActionPrompt="Quel livre ?"),
          ask("Tu en es à quelle page ?", "Number", page),
          ask("Résume ce que tu viens de lire (le micro du clavier permet de dicter).", "Text", resume)]
    a += rpc("log_reading", {"p_book": text(out(livre, "Élément choisi")), "p_page_end": text(out(page, "Entrée fournie")),
                             "p_summary": text(out(resume, "Entrée fournie"))}, "Lecture")
    g, cond = if_text(var("Lecture", "status"), IS, "ok")
    a += [*cond, alert("Bien joué", text(var("Lecture", "message"))),
          action("conditional", GroupingIdentifier=g, WFControlFlowMode=1),
          alert("Refusé", text(var("Lecture", "error"))), EXIT, end_if(g)]

    a += [action("choosefrommenu", GroupingIdentifier=m, WFControlFlowMode=1, WFMenuItemTitle="Utiliser mon solde"),
          action("choosefrommenu", GroupingIdentifier=m, WFControlFlowMode=1, WFMenuItemTitle="Annuler"), EXIT,
          action("choosefrommenu", GroupingIdentifier=m, WFControlFlowMode=2)]

    # ── Acheter des minutes ──
    minutes = uid()
    a += [ask(text("Combien de minutes sur ", INPUT, " ?"), "Number", minutes), set_var("Minutes", out(minutes, "Entrée fournie"))]
    a += rpc("start_session", {"p_app": text(INPUT), "p_minutes": text(var("Minutes"))}, "Session")
    g, cond = if_text(var("Session", "status"), IS, "ok")
    a += [*cond,
          action("timer.start", WFDuration={"Value": {"Unit": "min", "Magnitude": att(var("Session", "minutes"))}, "WFSerializationType": "WFQuantityFieldValue"}),
          action("conditional", GroupingIdentifier=g, WFControlFlowMode=1),
          alert("Refusé", text(var("Session", "error"))), EXIT, end_if(g)]
    # Rouvre l'appli si son schéma d'URL est connu du serveur ; sinon on la relance à la main.
    u_url = uid()
    a += [action("gettext", UUID=u_url, WFTextActionText=text(var("Session", "open_url")))]
    g, cond = if_(out(u_url, "Texte"), HAS_VALUE)
    a += [cond, action("openurl", WFInput=text(var("Session", "open_url"))), end_if(g)]

    return {"WFWorkflowClientVersion": "2302.0.4", "WFWorkflowMinimumClientVersion": 900, "WFWorkflowMinimumClientVersionString": "900",
            "WFWorkflowIcon": {"WFWorkflowIconStartColor": 4274264319, "WFWorkflowIconGlyphNumber": 59771},
            "WFWorkflowTypes": [], "WFWorkflowInputContentItemClasses": ["WFStringContentItem"],
            "WFWorkflowHasShortcutInputVariables": True, "WFWorkflowImportQuestions": [], "WFWorkflowActions": a}


if __name__ == "__main__":
    raw, signed = HERE / "Portier.unsigned.shortcut", HERE / "Portier.shortcut"
    raw.write_bytes(plistlib.dumps(portier(), fmt=plistlib.FMT_BINARY))
    r = subprocess.run(["shortcuts", "sign", "--mode", "anyone", "--input", str(raw), "--output", str(signed)], capture_output=True, text=True)
    if r.returncode or not signed.exists():
        sys.exit("Signature impossible : " + (r.stderr.strip() or "erreur inconnue") + "\nSuis la construction manuelle décrite dans SETUP.md.")
    raw.unlink()
    print("OK →", signed)
