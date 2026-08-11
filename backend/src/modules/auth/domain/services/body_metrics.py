"""Pure BMI / BMR / maintenance-calorie calculations.

No dependencies on persistence or the User entity's optional-field shape — callers
are responsible for checking completeness (see User.has_complete_profile()) before
calling these, since the formulas require every value to be present.
"""

from dataclasses import dataclass

ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,       # little or no exercise
    "light": 1.375,         # light exercise 1-3 days/week
    "moderate": 1.55,       # moderate exercise 3-5 days/week
    "active": 1.725,        # hard exercise 6-7 days/week
    "very_active": 1.9,     # very hard exercise + physical job
}


@dataclass
class BodyMetrics:
    bmi: float
    bmr: float
    maintenance_calories: float


def calculate_bmi(weight_kg: float, height_cm: float) -> float:
    """Body Mass Index: weight(kg) / height(m)^2."""
    height_m = height_cm / 100
    return round(weight_kg / (height_m * height_m), 1)


def calculate_bmr(weight_kg: float, height_cm: float, age: int, gender: str) -> float:
    """Basal Metabolic Rate via the Mifflin-St Jeor equation.

    Standard formula only defines male/female offsets (+5 / -161); any other
    gender value uses the average of the two, a common practical compromise
    when a third category isn't part of the original formula.
    """
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    if gender == "male":
        return round(base + 5, 1)
    if gender == "female":
        return round(base - 161, 1)
    return round(base + (5 + -161) / 2, 1)


def calculate_body_metrics(
    weight_kg: float, height_cm: float, age: int, gender: str, activity_level: str
) -> BodyMetrics:
    """Compute BMI, BMR, and estimated maintenance calories together."""
    bmi = calculate_bmi(weight_kg, height_cm)
    bmr = calculate_bmr(weight_kg, height_cm, age, gender)
    multiplier = ACTIVITY_MULTIPLIERS.get(activity_level, ACTIVITY_MULTIPLIERS["sedentary"])
    maintenance_calories = round(bmr * multiplier, 0)
    return BodyMetrics(bmi=bmi, bmr=bmr, maintenance_calories=maintenance_calories)
