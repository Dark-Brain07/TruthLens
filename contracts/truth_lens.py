# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class TruthLens(gl.Contract):
    true_count: u256
    false_count: u256
    unverified_count: u256
    last_verdict: str

    def __init__(self):
        self.true_count = u256(0)
        self.false_count = u256(0)
        self.unverified_count = u256(0)
        self.last_verdict = "NONE"

    @gl.public.write
    def fact_check(self, claim_url: str) -> str:
        def _fetch_claim() -> str:
            response = gl.nondet.web.get(claim_url)
            return response.body.decode("utf-8")[:2000]

        claim_content = gl.eq_principle.strict_eq(_fetch_claim)

        prompt = (
            "You are an expert fact-checker. Analyze the following content. "
            "If the claims are factually accurate, output TRUE. "
            "If the claims contain misinformation, output FALSE. "
            "If the claims cannot be confirmed, output UNVERIFIED. "
            "Output ONLY the single word: TRUE, FALSE, or UNVERIFIED.\n\n"
            f"CONTENT:\n{claim_content}"
        )

        def _analyze() -> str:
            return gl.nondet.exec_prompt(prompt)

        verdict_raw = gl.eq_principle.prompt_comparative(
            _analyze,
            principle="Both analyses must reach the same conclusion: TRUE, FALSE, or UNVERIFIED."
        )

        clean = verdict_raw.strip().upper()
        if "FALSE" in clean:
            self.last_verdict = "FALSE"
            self.false_count += u256(1)
        elif "UNVERIFIED" in clean:
            self.last_verdict = "UNVERIFIED"
            self.unverified_count += u256(1)
        else:
            self.last_verdict = "TRUE"
            self.true_count += u256(1)

        return self.last_verdict

    @gl.public.view
    def get_stats(self) -> str:
        return f"Total: {self.true_count + self.false_count + self.unverified_count} | True: {self.true_count} | False: {self.false_count} | Unverified: {self.unverified_count}"

    @gl.public.view
    def get_last_verdict(self) -> str:
        return self.last_verdict
