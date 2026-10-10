import requests
import json
import sys

__test__ = False

ANSWER_KEY = {
    "1": "supported",
    "2": "contradicted",
    "3": "contradicted",
    "4": "supported",
    "5": "contradicted",
    "6": "ambiguous",
    "7": "unsupported",
    "8": "unsupported",
    "9": "supported",
    "10": "unsupported",
    "11": "unsupported"
}

def run():
    with open("demo/inputs/fr-crce-answer-v2.txt", "r", encoding="utf-8") as f:
        answer_text = f.read()

    url = "http://localhost:8000/api/audit"
    files = {
        "pdf": ("fr-crce-info.pdf", open("demo/inputs/fr-crce-info.pdf", "rb"), "application/pdf")
    }
    data = {
        "answer": answer_text
    }

    print("Running audit against http://localhost:8000/api/audit ...")
    response = requests.post(url, files=files, data=data, timeout=120)
    if response.status_code != 200:
        print(f"Error {response.status_code}: {response.text}")
        sys.exit(1)

    result = response.json()
    with open("demo/cache/fr-crce-v2.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print("Saved response to demo/cache/fr-crce-v2.json\n")

    print(f"{'Claim ID':<9} | {'Answer Key':<12} | {'Predicted':<12} | {'Confidence':<10} | {'needs_review':<12} | {'passes_agree':<12} | {'Evidence Verified'}")
    print("-" * 90)

    for c in result.get("claims", []):
        cid = str(c.get("id"))
        ak_label = ANSWER_KEY.get(cid, "unsupported")
        pred_label = c.get("label")
        conf = c.get("confidence")
        needs_rev = c.get("needs_review")
        passes_agr = c.get("checks", {}).get("passes_agree")
        ev_list = c.get("evidence", [])
        ev_verified = [e.get("verified") for e in ev_list]
        print(f"{cid:<9} | {ak_label:<12} | {pred_label:<12} | {conf:<10} | {str(needs_rev):<12} | {str(passes_agr):<12} | {ev_verified}")

    print("\nReasoning Issues:")
    for issue in result.get("issues", []):
        print(f"- [{issue.get('type')}] {issue.get('text')}")
        print(f"  Explanation: {issue.get('explanation')}")

if __name__ == "__main__":
    run()
