export interface FormulaSource {
  id: string;
  citation: string;
  link: string;
}

/** Every published source the engine, ranges and explainers rely on. */
export const FORMULA_SOURCES: readonly FormulaSource[] = [
  {
    id: 'sun2003',
    citation:
      'Sun SS, Chumlea WC, Heymsfield SB, et al. Development of bioelectrical impedance analysis prediction equations for body composition. Am J Clin Nutr 2003;77(2):331-340.',
    link: 'https://doi.org/10.1093/ajcn/77.2.331',
  },
  {
    id: 'janssen2000',
    citation:
      'Janssen I, Heymsfield SB, Baumgartner RN, Ross R. Estimation of skeletal muscle mass by bioelectrical impedance analysis. J Appl Physiol 2000;89(2):465-471.',
    link: 'https://doi.org/10.1152/jappl.2000.89.2.465',
  },
  {
    id: 'katchMcArdle',
    citation: 'Katch-McArdle formula, in McArdle WD, Katch FI, Katch VL. Exercise Physiology.',
    link: 'https://en.wikipedia.org/wiki/Basal_metabolic_rate#BMR_estimation_formulas',
  },
  {
    id: 'mifflin1990',
    citation:
      'Mifflin MD, St Jeor ST, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr 1990;51(2):241-247.',
    link: 'https://doi.org/10.1093/ajcn/51.2.241',
  },
  {
    id: 'gallagher2000',
    citation:
      'Gallagher D, et al. Healthy percentage body fat ranges: an approach for developing guidelines based on body mass index. Am J Clin Nutr 2000;72(3):694-701.',
    link: 'https://doi.org/10.1093/ajcn/72.3.694',
  },
  {
    id: 'who2004',
    citation:
      'WHO Expert Consultation. Appropriate body-mass index for Asian populations and its implications for policy and intervention strategies. Lancet 2004;363:157-163.',
    link: 'https://doi.org/10.1016/S0140-6736(03)15268-3',
  },
  {
    id: 'janssen2002',
    citation:
      'Janssen I, Heymsfield SB, Ross R. Low relative skeletal muscle mass (sarcopenia) in older persons is associated with functional impairment and physical disability. J Am Geriatr Soc 2002;50(5):889-896.',
    link: 'https://doi.org/10.1046/j.1532-5415.2002.50216.x',
  },
  {
    id: 'helms2014',
    citation:
      'Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr 2014;11:20.',
    link: 'https://doi.org/10.1186/1550-2783-11-20',
  },
  {
    id: 'openscale',
    citation:
      'openScale StandardImpedanceLib (bone mass as a fixed share of fat-free mass). Used as a heuristic; no published foot-to-foot equation exists.',
    link: 'https://github.com/oliexdev/openScale',
  },
  {
    id: 'vendor',
    citation:
      'Conventional vendor ranges and Health Hub heuristics, as used by consumer scales and monitors. Not from a peer-reviewed source.',
    link: 'https://github.com/oliexdev/openScale/wiki',
  },
];
