"""
Population Priors for Cold-Start Behavioral Modeling.

Provides demographic, city-tier, and account-tier cohort baselines
for new users with insufficient transaction history (<30 transactions).
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel


class CohortProfile(BaseModel):
    cohort_name: str
    avg_amount_30d: float
    std_amount_30d: float
    avg_txn_hour_30d: float
    std_txn_hour_30d: float
    home_radius_km: float
    pct_new_receivers_7d: float
    max_amount_30d: float


class PopulationPriors:
    """Cohort baselines based on financial demography in India UPI ecosystem."""

    COHORTS = {
        "TIER1_METRO": CohortProfile(
            cohort_name="TIER1_METRO",
            avg_amount_30d=1850.0,
            std_amount_30d=2400.0,
            avg_txn_hour_30d=14.5,
            std_txn_hour_30d=4.5,
            home_radius_km=25.0,
            pct_new_receivers_7d=0.25,
            max_amount_30d=25000.0
        ),
        "TIER2_CITY": CohortProfile(
            cohort_name="TIER2_CITY",
            avg_amount_30d=1200.0,
            std_amount_30d=1500.0,
            avg_txn_hour_30d=13.5,
            std_txn_hour_30d=4.0,
            home_radius_km=15.0,
            pct_new_receivers_7d=0.18,
            max_amount_30d=15000.0
        ),
        "DEFAULT_NATIONAL": CohortProfile(
            cohort_name="DEFAULT_NATIONAL",
            avg_amount_30d=1000.0,
            std_amount_30d=1200.0,
            avg_txn_hour_30d=14.0,
            std_txn_hour_30d=4.0,
            home_radius_km=15.0,
            pct_new_receivers_7d=0.20,
            max_amount_30d=10000.0
        )
    }

    @classmethod
    def get_prior(cls, city_tier: Optional[str] = None) -> CohortProfile:
        if city_tier and city_tier.upper() in cls.COHORTS:
            return cls.COHORTS[city_tier.upper()]
        return cls.COHORTS["DEFAULT_NATIONAL"]


population_priors = PopulationPriors()
