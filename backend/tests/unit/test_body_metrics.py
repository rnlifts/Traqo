"""Unit tests for body_metrics.py — BMI/BMR/maintenance-calorie formulas."""

from src.modules.auth.domain.services.body_metrics import (
    calculate_bmi,
    calculate_bmr,
    calculate_body_metrics,
    ACTIVITY_MULTIPLIERS,
)


class TestCalculateBmi:
    def test_known_value(self):
        # 70kg / (1.75m)^2 = 22.857... -> 22.9
        assert calculate_bmi(weight_kg=70, height_cm=175) == 22.9

    def test_rounds_to_one_decimal(self):
        assert calculate_bmi(weight_kg=68, height_cm=175) == 22.2


class TestCalculateBmr:
    def test_male_mifflin_st_jeor(self):
        # 10*70 + 6.25*175 - 5*25 + 5 = 700 + 1093.75 - 125 + 5 = 1673.75
        assert calculate_bmr(weight_kg=70, height_cm=175, age=25, gender="male") == 1673.8

    def test_female_mifflin_st_jeor(self):
        # 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
        assert calculate_bmr(weight_kg=60, height_cm=165, age=30, gender="female") == 1320.2

    def test_other_gender_uses_average_of_male_and_female_offsets(self):
        base = 10 * 70 + 6.25 * 175 - 5 * 25  # = 1793.75
        expected = round(base + (5 + -161) / 2, 1)
        assert calculate_bmr(weight_kg=70, height_cm=175, age=25, gender="other") == expected
        # Sanity: sits exactly between the male and female results for the same inputs.
        male = calculate_bmr(weight_kg=70, height_cm=175, age=25, gender="male")
        female = calculate_bmr(weight_kg=70, height_cm=175, age=25, gender="female")
        assert expected == round((male + female) / 2, 1)


class TestCalculateBodyMetrics:
    def test_combines_bmi_bmr_and_maintenance_calories(self):
        result = calculate_body_metrics(
            weight_kg=70, height_cm=175, age=25, gender="male", activity_level="moderate"
        )

        assert result.bmi == 22.9
        assert result.bmr == 1673.8
        assert result.maintenance_calories == round(1673.8 * ACTIVITY_MULTIPLIERS["moderate"], 0)

    def test_unknown_activity_level_falls_back_to_sedentary(self):
        result = calculate_body_metrics(
            weight_kg=70, height_cm=175, age=25, gender="male", activity_level="not-a-real-level"
        )

        assert result.maintenance_calories == round(1673.8 * ACTIVITY_MULTIPLIERS["sedentary"], 0)

    def test_every_activity_level_produces_a_higher_maintenance_than_sedentary(self):
        bmr_only = calculate_bmr(weight_kg=70, height_cm=175, age=25, gender="male")
        for level, multiplier in ACTIVITY_MULTIPLIERS.items():
            if level == "sedentary":
                continue
            result = calculate_body_metrics(
                weight_kg=70, height_cm=175, age=25, gender="male", activity_level=level
            )
            assert result.maintenance_calories > round(bmr_only * ACTIVITY_MULTIPLIERS["sedentary"], 0)
