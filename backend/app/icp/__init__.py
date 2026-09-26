"""Ideal-customer-profile semantics.

``geography`` and ``employees`` are pure resolvers with no dependency on the contract
models, so ``app.contracts.icp`` can use them while building the contract itself.
``evaluation`` is imported explicitly by the research pipeline and depends on the scoring
models.
"""
