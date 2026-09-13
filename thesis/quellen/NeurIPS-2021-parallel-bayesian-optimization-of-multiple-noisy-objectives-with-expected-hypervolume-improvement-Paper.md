# NeurIPS-2021-parallel-bayesian-optimization-of-multiple-noisy-objectives-with-expected-hypervolume-improvement-Paper

Quelle: C:\Users\Felix\Desktop\Master\Thesis\Quellen\ML\NeurIPS-2021-parallel-bayesian-optimization-of-multiple-noisy-objectives-with-expected-hypervolume-improvement-Paper.pdf

---
Parallel Bayesian Optimization of Multiple Noisy
Objectives with Expected Hypervolume Improvement
Samuel Daulton
Facebook, University of Oxford
sdaulton@fb.com
Maximilian Balandat
Facebook
balandat@fb.com
Eytan Bakshy
Facebook
ebakshy@fb.com
Abstract
Optimizing multiple competing black-box objectives is a challenging problem in
many ﬁelds, including science, engineering, and machine learning. Multi-objective
Bayesian optimization (MOBO) is a sample-efﬁcient approach for identifying
the optimal trade-offs between the objectives. However, many existing methods
perform poorly when the observations are corrupted by noise. We propose a novel
acquisition function, NEHVI , that overcomes this important practical limitation by
applying a Bayesian treatment to the popular expected hypervolume improvement
(EHVI ) criterion and integrating over this uncertainty in the Pareto frontier. We
argue that, even in the noiseless setting, generating multiple candidates in parallel
is an incarnation of EHVI with uncertainty in the Pareto frontier and therefore
can be addressed using the same underlying technique. Through this lens, we
derive a natural parallel variant,qNEHVI , that reduces computational complexity
of parallel EHVI from exponential to polynomial with respect to the batch size.
qNEHVI is one-step Bayes-optimal for hypervolume maximization in both noisy
and noiseless environments, and we show that it can be optimized effectively
with gradient-based methods via sample average approximation. Empirically, we
demonstrate not only that qNEHVI is substantially more robust to observation
noise than existing MOBO approaches, but also that it achieves state-of-the-art
optimization performance and competitive wall-times in large-batch environments.
1 Introduction
Black-box optimization problems that involve multiple competing noisy objectives are ubiquitous
in science and engineering. For example, a real-time communications service may be interested in
tuning the parameters of a control policy to adapt video quality in real time in order to maximize
video quality and minimize latency [ 10, 17]. In robotics, scientists may seek to design hardware
components that maximize locomotive speed and minimize energy expended [8, 38]. In agriculture,
development agencies may seek to balance crop yield and environmental impact [ 28]. For such
multi-objective optimization (MOO) problems, there typically is no single solution that is best with
respect to all objectives. Rather, the goal is to identify the Pareto frontier: a set of optimal trade-offs
such that improving one objective means deteriorating another. In many cases, the objectives are
expensive to evaluate. For instance, randomized trials used in agriculture and the internet industry
may take weeks or months to conduct and incur opportunity costs, and manufacturing and testing
hardware is both costly and time-consuming. Therefore, it is imperative to be able to identify good
trade-offs with as few objective evaluations as possible.
Bayesian optimization (BO), a method for efﬁcient global black-box optimization, is often used to
tackle such problems. BO employs a probabilistic surrogate model in conjunction with an acquisition
function to navigate the trade-off between exploration (evaluating designs with high uncertainty)
and exploitation (evaluating designs that are believed to be optimal). Although a signiﬁcant number
of works have explored multi-objective Bayesian optimization (MOBO), most available methods
35th Conference on Neural Information Processing Systems (NeurIPS 2021)

[3, 39, 51, 60] do not take into account the fact that, in practice, observations are often subject to
noise. For example, results of an A/B test are highly variable due to heterogeneity in the underlying
user population and other factors. Agricultural trials are affected by the stochastic nature of plant
growth and environmental factors such as soil composition or wind currents. In robotics, devices are
subject to manufacturing tolerances, and observations of quantities such as locomotive speed and
efﬁciency may be corrupted by measurement error from noisy sensors and environmental factors
such as temperature or surface friction. While previous work has shown that a principled treatment of
noisy observations can signiﬁcantly improve optimization performance in the single-objective case
[24, 37], this issue is understudied in the multi-objective setting. Furthermore, many applications in
which evaluations take a long time require evaluating large batches of candidates in parallel in order
to achieve reasonable throughput. For example, when ﬁrms optimize systems via A/B tests, it may
take several weeks to test any particular conﬁguration. Because of this, large batches of candidate
policies are tested simultaneously [36]. In biochemistry and materials design, dozens of tests can
be conducted parallel on a single microplate [63]. Even in sophisticated high throughput chemistry
settings, these batches may take several hours or days to set up and evaluate [ 42]. Most existing
MOBO methods, however, are either designed for purely sequential optimization [3, 51] or do not
scale well to large batch sizes [11].
Contributions: In this work, we propose a novel MOBO algorithm, based on expected hypervolume
improvement (EHVI), that scales to highly parallel evaluations of noisy objectives. Our approach is
made possible by a general-purpose, differentiable, cached box decomposition (CBD) implementation
that dramatically speeds up critical computations needed to account for uncertainty introduced by
noisy observations and generate new candidate points for highly parallel batch or asynchronous
evaluation. In particular, our CBD-based approach solves the fundamental problem of scaling parallel
EHVI-based methods to large batch sizes, reducing time and space complexity from exponential to
polynomial. Our proposed algorithm, noisy expected hypervolume improvement (NEHVI ), is the one-
step Bayes-optimal policy for hypervolume improvement and provides state-of-the-art performance
across a variety of benchmarks. To our knowledge, our work provides the most extensive evaluation
of noisy parallel MOBO to date. A high-quality implementation of qNEHVI , as well as many of the
baselines considered here, will be made available as open-source software upon publication.
2 Preliminaries
Our goal is to ﬁnd the set of optimal designs x over a bounded setX⊂ Rd that maximize one or
more objectivesf(x)∈ RM , with no known analytical expression nor gradient information off.
Multi-Objective Optimization (MOO) aims to identify the set of Pareto optimal objective trade-
offs. We say a solutionf(x) =
[
f (1)(x),...,f (M )(x)
]
dominates another solutionf(x)≻f(x′) if
f (m)(x)≥f (m)(x′) form = 1,...,M and∃m∈{ 1,...,M} s.t.f (m)(x)>f (m)(x′). We deﬁne
the Pareto frontier asP∗ ={f(x) :x∈X , ∄x′∈X s.t.f(x′)≻f(x)}, and denote the set of
Pareto optimal designs asX∗ ={x :f(x)∈P∗}. Since the Pareto frontier (PF) is often an inﬁnite
set of points, MOO algorithms usually aim to identify a ﬁnite approximate PF P. A natural measure
of the quality of a PF is the hypervolume of the region of objective space that is dominated by the PF
and bounded from below by a reference point. Provided with the approximate PF, the decision-maker
can select a particular Pareto optimal trade-off according to their preferences.
Bayesian Optimization (BO) is a sample-efﬁcient optimization method that leverages a probabilistic
surrogate model to make principled decisions to balance exploration and exploitation [ 19, 50].
Typically, the surrogate is a Gaussian Process (GP), a ﬂexible, non-parametric model known for its
well-calibrated predictive uncertainty [47]. To decide which points to evaluate next, BO employs
an acquisition function α(·) that speciﬁes the value of evaluating a set of new points x based on
the surrogate’s predictive distribution at . While evaluating the true black-box functionf is time-
consuming or costly, evaluating the surrogate is cheap and relatively fast; therefore, numerical
optimization can be used to ﬁnd the maximizer of the acquisition functionx∗ = arg maxx∈Xα(x)
to evaluate next on the black-box function. BO sequentially selects new points to evaluate and updates
the model to incorporate the new observations.
Evolutionary algorithms (EAs) such as NSGA-II [12] are a popular choice for solving MOO problems
(see Zitzler et al. [67] for a review of various other approaches). However, EAs generally suffer from
high sample complexity, rendering them infeasible for optimizing expensive-to-evaluate black-box
2

functions. Multi-objective Bayesian optimization (MOBO), which combines a Bayesian surrogate
with an acquisition function designed for MOO, provides a much more sample-efﬁcient alternative.
3 Related Work
Methods based on hypervolume improvement (HVI) seek to expand the volume of the objective space
dominated by the Pareto frontier. Expected hypervolume improvement ( EHVI ) [16] is a natural
extension of the popular expected improvement (EI) [29] acquisition function to the MOO setting.
Recent work has led to efﬁcient computational paradigms using box decomposition algorithms [59]
and practical enhancements such as support for parallel candidate generation and gradient-based
acquisition optimization [11, 58]. However, EHVI still suffers from some limitations, including (i)
the assumption that observations are noise-free, and (ii) the exponential scaling of its batch variant,
qEHVI , in the batch size q, which precludes large-batch optimization. DGEMO [ 39] is a recent
method for parallel MOBO that greedily maximizes HVI while balancing the diversity of the design
points being sampled. Although DGEMO scales well to large batch sizes, it does not account for
noisy observations. TSEMO [5] is a Thompson sampling (TS) heuristic that can acquire batches of
points by optimizing a random fourier feature (RFF) [ 46] approximation of a GP surrogate using
NSGA-II and selecting a subset of points from the EA’s population to sequentially greedily maximize
HVI. This heuristic approach for maximizing HVI currently has no theoretical guarantees and relies
on zeroth-order optimization methods, which tend to be slower and exhibit worse optimization
performance than gradient-based approaches.
Entropy-based methods such as PESMO [ 25], MESMO [3], and PFES [ 51] are an alternative to
EHVI . Of these three methods, PESMO is the only one that accounts for observation noise. However,
PESMO involves intractable entropy computations and therefore relies on complex approximations,
as well as challenging and time-consuming numerical optimization procedures [25]. Garrido-Merchán
& Hernández-Lobato [21] recently proposed an extension to PESMO that supports parallel candidate
generation. However, the authors of this work provide limited evaluation and have not provided code
to reproduce their results.1
MOO can also be cast into a single-objective problem by applying a random scalarization of the
objectives. ParEGO maximizes the expected improvement using random augmented Chebyshev
scalarizations [32]. MOEA/D-EGO [64] extends ParEGO to the batch setting using multiple random
scalarizations and the genetic algorithm MOEA/D [65] to optimize these scalarizations in parallel.
Recently,qParEGO, another batch variant of ParEGO was proposed that uses compositional Monte
Carlo objectives and sequential greedy candidate selection [11]. Additionally, the authors proposed
a noisy variant,qNParEGO, but the empirical evaluation of that variant was limited. TS-TCH [45]
combines random Chebyshev scalarizations with Thompson sampling [54], which is naturally robust
to noise when the objective is scalarized. Golovin & Zhang [23] propose to use a hypervolume
scalarization with the property that the expected value of the scalarization over a speciﬁc distribution
of weights is equivalent to the hypervolume indicator. The authors propose a upper conﬁdence bound
algorithm using randomly sampled weights, but provide a very limited empirical evaluation.
Many prior attempts by the simulation community to handle MOO with noisy observations found
that accounting for the noise did not improve optimization performance: Horn et al. [26] suggest
that the best approach is to ignore noise, and Koch et al. [33] concluded that further research was
needed to determine if modeling techniques such as re-interpolation could improve BO performance
with noisy observations. In contrast, we ﬁnd that accounting for noise does substantially improve
performance in noisy settings.
Lastly, previous works have considered methods for quantifying and monitoring uncertainty in the
Pareto frontiers during the optimization [ 4, 7]. In contrast, we provide a solution to performing
MOBO in noisy settings, rather than purely reasoning about the uncertainty in the Pareto frontier.
4 Background on Expected Hypervolume Improvement
In this section, we review hypervolume, hypervolume improvement, and expected hypervolume
improvement as well as efﬁcient methods for computing these metrics using box decompositions.
1We contacted the authors twice asking for code to reproduce their results, but they graciously declined.
3

Deﬁnition 1. The hypervolume indicator ( HV) of a ﬁnite approximate Pareto frontier P is the
M-dimensional Lebesgue measureλM of the space dominated byP and bounded from below by a
reference point.r∈ RM : HV(P|r) =λM
(⋃
v∈P[r,v]
)
, where [r,v] denotes the hyper-rectangle
bounded by verticesr andv.
As in previous work, we assume that the reference pointr is known and speciﬁed by the decision
maker [58].
Deﬁnition 2. The hypervolume improvement (HVI) of a set of pointsP′ w.r.t. an existing approximate
Pareto frontierP and reference pointr is deﬁned as2 HVI(P′|P,r) = HV(P∪P ′|r)− HV(P|r).
Computing HV requires calculating the volume of a typically non-rectangular polytope and is known
to have time complexity that is super-polynomial in the number of objectives [ 59]. An efﬁcient
approach for computing HV is to (i) decompose the region that is dominated by the Pareto frontier
P and bounded from below by the reference point r into disjoint axis-aligned hyperrectangles
[34], (ii) compute the volume of each hyperrectangle in the decomposition, and (iii) sum over all
hyperrectangles. So-called box decomposition algorithms have also been applied to partition the
region that is not dominated by the Pareto frontierP, which can be used to compute the HVI from a
set of new points [15, 59]. See Appendix B for further details.
Expected Hypervolume Improvement: Since function values at unobserved points are unknown in
black-box optimization, so is the HVI of an out-of-sample point. However, in BO the probabilistic
surrogate model provides a posterior distribution p(f(x)|D) over the function values for each x,
which can be used to compute the expected hypervolume improvement (EHVI ) acquisition function:
αEHVI (x|P) = E
[
HVI(f(x)|P)
]
. Although αEHVI can be expressed analytically when (i) the
objectives are assumed to be conditionally independent givenx and (ii) the candidates are generated
and evaluated sequentially [58], Monte Carlo (MC) integration is commonly used since it does not
require either assumption [16]. The more general parallel variant using MC integration is given by
αqEHVI (Xcand|P)≈ ˆαqEHVI (Xcand|P) = 1
N
N∑
t=1
HVI( ˜ft(Xcand)|P), (1)
where ˜ft∼ p(f|D) for t = 1,...,N andXcand ={xi}q
i=1 [11]. The same box decomposition
algorithms used to compute HVI can be used to compute EHVI (either analytic or via MC) using
piece-wise integration. EHVI computation is agnostic to the choice of box decomposition algorithm
(and can also use approximate methods [ 9]). Similar to EI in the single-objective case, EHVI is
a one-step Bayes-optimal algorithm for maximizing hypervolume in the MOO setting under the
following assumptions: (i) only a single design will be generated and evaluated, (ii) the observations
are noise-free, (iii) the ﬁnal approximate Pareto frontier (and ﬁnal design that will be deployed) will
be drawn from the set of observed points [19].
5 Expected Hypervolume Improvement with Noisy Observations
We consider the case that frequently arises in practice where we only receive noisy observations
yi = f(xi) +ϵi,ϵi∼N (0, Σi), where Σi is the noise covariance. In this setting, EHVI is no
longer (one-step) Bayes-optimal. This is because we can no longer compute the true Pareto frontier
Pn ={f(x)|x∈Xn, ∄x′∈Xns.t.f(x′)≻f(x)} over the previously evaluated pointsXn =
{xi}n
i=1. Simply using the observed Pareto frontier,Yn ={y|y∈Yn, ∄y′∈Yns.t.y′≻y,y}
whereYn ={yi}n
i=1, can have strong detrimental effects on optimization performance. This is
illustrated in Figure 1, which shows how EHVI is misled by noisy observations that appear to be
Pareto optimal. EHVI proceeds to spend its evaluation budget trying to optimize noise, resulting in a
clumped Pareto frontier that lacks diversity. Although the posterior mean could serve as a "plug-in"
estimate of the true function values at the observed points and provide some regularization [61], we
ﬁnd that this heuristic also leads to clustered Pareto frontiers (EHVI-PM in Fig. 1). Similar patterns
emerge with DGEMO (which does not account for noise), and other baselines that utilize the posterior
mean rather than the observed values when computing hypervolume improvement (see Appendix H).
To our knowledge, all previous work onEHVI assumes that observations are noiseless [16, 58] or
imputes the unknown true function values with the posterior mean.
2For brevity we omit the reference point r when referring to HVI.
4

-15 -10 -5 0
Objective 1
-6
-5
-4
-3
-2
-1Objective 2
 NEHVI
EHVI
EHVI-PM
Ref. Point
True PF
Figure 1: An illustration of the effect of noisy observations on
the true noiseless Pareto frontiers identiﬁed by NEHVI (our pro-
posed algorithm), EHVI , and EHVI -PM, which uses the modeled
posterior mean as point estimate of the true in-sample function
values. All algorithms are tested on a BraninCurrin synthetic prob-
lem, where observations are corrupted with zero-mean, additive
Gaussian noise with a standard deviation of 5% of the range of
respective objective. All methods use sequential (q = 1) optimiza-
tion. See Appendix G for details.
5.1 A Bayes-optimal algorithm for hypervolume maximization in noisy environments
In contrast with EHVI(-PM), we instead approach the problem of hypervolume maximization under
noisy observations from a Bayesian perspective and derive a novel one-step Bayes-optimal expected
hypervolume improvement criterion that iterates the expectation over the posterior distribution
p(f(Xn)|Dn) of the function values at the previously evaluated points Xn given noisy observa-
tionsDn ={xi,yi, (Σi)}n
i=1. Our acquisition function, noisy expected hypervolume improvement
(NEHVI), is deﬁned as
αNEHVI (x) =
∫
αEHVI (x|Pn)p(f|Dn)df (2)
wherePn denotes the Pareto frontier overf(Xn).
By integrating over the uncertainty in the function values at the observed points, NEHVI retains
one-step Bayes-optimality in noisy environments (in noiseless environments,NEHVI is equivalent to
EHVI ). Empirically, Figure 1 shows that NEHVI is robust to noise and identiﬁes a well-distributed
Pareto frontier with no signs of clumping, even under very noisy observations.3
The integral in (2) is analytically intractable, but can easily be approximated using MC integration.
Let ˜ft ∼ p(f|Dn) for t = 1,...N be samples from the posterior, and let Pt ={ ˜ft(x)|x∈
Xn, ˜ft(x)≻ ˜ft(x′)∀x′∈Xn} be the Pareto frontier over the previously evaluated points under
the sampled function ˜ft. Then, αNEHVI (x)≈ 1
N
∑N
t=1αEHVI (x|Pt). Using MC integration, we
can compute the inner expectation inαEHVI simultaneously using samples from the joint posterior
˜ft(Xn,x)∼p(f(Xn,x)|Dn) overx andXn:
ˆαNEHVI (x) = 1
N
N∑
t=1
HVI( ˜ft(x)|Pt). (3)
See Appendix B for details on computing (3) using box decompositions. Note that this “full-MC”
variant of NEHVI does not require objectives to be modeled independently, and supports multi-task
covariance functions across correlated objectives.
5.2 Parallel Noisy Expected Hypervolume Improvement
Generating and evaluating batches of candidates is imperative to achieving adequate throughput in
many real-world scenarios. q NEHVI can naturally be extended to the parallel (asynchronous or
batch) setting by evaluating HVI with respect to a batch of q pointsXcand ={xi}q
i=1
αqNEHVI (Xcand) =
∫
αqEHVI (Xcand|Pn)p(f|Dn)df≈ ˆαqNEHVI (Xcand) = 1
N
N∑
t=1
HVI( ˜ft(Xcand)|Pt)
(4)
Since optimizing q candidates jointly is a difﬁcult numerical optimization problem over a qd-
dimensional domain, we use a sequential greedy approximation in the parallel setting and solve a
sequence of q simpler optimization problems with d dimensions, which been shown empirically
to improve optimization performance [57]. While selecting candidates according to a “sequential
greedy” policy does not guarantee that the selected batch of candidates is a maximizer of theαqNEHVI ,
the submodularity ofαqNEHVI allows us to bound the regret of this approximation to be no more than
1
eα∗
qNEHVI , whereα∗
qNEHVI = maxXcand∈XαqNEHVI (Xcand) (see Appendix F).
3This noise level is 5x greater than the ones considered by previous works that evaluate noisy MOBO [25].
5

6 Efﬁcient Evaluation with Cached Box Decompositions
Although ˆαNEHVI (x) in (3) has a concise mathematical form, computing it requires determining the
Pareto frontierPt under each sample ˜ft fort = 1,...,N and then partitioning the region that is not
dominated byPt into disjoint hyperrectangles{Skt}Kt
kt=1. Optimizing the unbiased MC estimator
ofαNEHVI would require re-sampling{ ˜ft}N
t=1 at each evaluation ofαNEHVI . However, computing
the Pareto frontier and performing a box decomposition under each of theN samples during every
evaluation of αNEHVI in the inner optimization loop ( x∗ = arg maxxαNEHVI (x|Dn)) would be
prohibitively expensive. This is because box decomposition algorithms have super-polynomial time
complexity in the number of objectives [59]. We instead propose an efﬁcient alternative computational
technique for repeated evaluations of EHVI with uncertain Pareto frontiers.
Cached Box Decompositions: For repeated evaluations of the integral in (2), we use a set of ﬁxed
samples{ ˜ft(Xn)}N
t=1, which allows us to compute the Pareto frontiers and box decompositions once,
and cache them for the entirety of the acquisition function optimization, thereby making those two
computationally intensive operations a one-time cost per BO iteration.4 We refer to this approach as
using cached box decompositions (CBD ). The method of optimizing over ﬁxed random samples is
known as sample average approximation (SAA) [2].
Conditional Posterior Sampling: Under the CBD formulation, computing ˆαNEHVI (x) with joint
samples from ˜ft(Xn,x)∼p(f(Xn,x)|Dn) requires sampling from the conditional distributions
˜ft(x)∼p
(
f(x)|f(Xn) = ˜ft(Xn),Dn
)
, (5)
wheret = 1,...,N and{ ˜ft(Xn)}N
t=1 are the realized samples at the previously evaluated points.
For multivariate Gaussian posteriors (as is the case with GP surrogates), we can sample from
p(f(Xn)|Dn) via the reparameterization trick [ 30] by evaluating ˜ft(x) = µn +LT
nζn,t, where
ζn,t∼N (0,InM),µn∈ RnM is the posterior mean, andLn∈ RnM×nM is a lower triangular root
decomposition of the posterior covariance matrix, typically a Cholesky decomposition. GivenLn, we
can obtain a root decompositionL′
n of the covariance matrix of the joint posteriorp(f(Xn,x)|Dn)
by performing efﬁcient low-rank updates [44]. GivenL′
n and the posterior mean ofp(f(Xn,x)|Dn),
we can sample from (5) via the reparameterization trick by augmenting the existing base samples
ζn,t withM new base samples for the new point.
6.1 Efﬁcient Sequential Greedy Batch Selection using CBD
The CBD technique addresses the general problem of inefﬁcient repeated evaluations of EHVI with
uncertain Pareto frontiers. In this section, we show that sequential greedy batch selection (with both
qEHVI and qNEHVI) is an incarnation of EHVI with uncertain Pareto frontiers.
The original formulation of parallel EHVI in Daulton et al.[11] uses the inclusion-exclusion principle
(IEP ), which involves computing the volume jointly dominated by each of the 2q− 1 nonempty
subsets of points inXcand. However, using large batch sizes is not computationally feasible under
this formulation because time and space complexity are exponential inq and multiplicative in the
number of hyperrectangles in the box decomposition [11] (see Appendix D for a complexity analysis).
AlthoughqEHVI is optimized using sequential greedy batch selection, the IEP is used over all
candidatesx1,...,xi when selecting candidate i. Although the IEP could similarly be used to
computeqNEHVI , we instead leverage CBD, which yields a sequential greedy approximation of the
joint (noisy) EHVI that is mathematically equivalent to the IEP formulation, but signiﬁcantly reduces
computational overhead. That is, the IEP and CBD approaches produce exactly the same acquisition
value for a given set of pointsXcand, but the IEP and the CBD approaches have exponential and
polynomial time complexities inq, respectively.
When selectingxi fori∈{ 2,...,q }, allxj for which j < ihave already been selected and are
therefore held constant. Thus, we can decomposeqNEHVI into theqNEHVI from the previously
selected candidatesx1,..., xi−1 and NEHVI from xi given the previously selected candidates
4For greater efﬁciency, we may also pruneXn to remove points that are dominated with high probability,
which we estimate via MC.
6

0 20 40 60 80 100
q
0
100
200
300Acquisition Optimization Time (s)
CBD (CPU)
CBD (GPU)
IEP (CPU)
IEP (GPU)
OOM
Figure 2: Acquisition optimization wall time under a sequential
greedy approximation using L-BFGS-B. CBD enables scaling to
much larger batch sizesq than using the IEP and avoids running
out-of-memory (OOM) on a GPU. Independent GPs are used
for each outcome. The Pareto frontier of of the 2-objective, 6-
dimensional DTLZ2 problem [ 13] is initialized with 20 points.
Wall times were measured on a Tesla V100 SXM2 GPU (16GB
RAM) and a 2x Intel Xeon 6138 CPU @ 2GHz (251GB RAM).
See Appendix H.2 for results with more objectives.
ˆαqNEHVI ({xj}i
j=1) = 1
N
N∑
t=1
HVI
(
{ ˜ft(xj)}i−1
j=1}|P t
)
+ 1
N
N∑
t=1
HVI
( ˜ft(xi)|Pt∪{ ˜ft(xj)}i−1
j=1}
)
(6)
Note that the ﬁrst term on the right hand side is constant, since {xj}i−1
j=1 and{ ˜ft(xj)}i−1
j=1 are
ﬁxed for all t = 1,...,N . The second term is ˆαNEHVI (xi), where the NEHVI is taken with
respect to the Pareto frontier across f(Xn,x1,...,xi−1) and computed using the ﬁxed samples
{ ˜ft(Xn,x1,...xi−1)}N
t=1. To compute the second term when selecting candidatexi, theN Pareto
frontiers and CBD s are updated to include{ ˜ft(Xn,x1,...xi−1)}N
t=1. As in the sequential q = 1
setting, the box decompositions are only computed and cached while selecting each candidate point.
See Appendix C.2 for a derivation of (6). Although we have focused onqNEHVI in the above, the
CBD formulation forqEHVI is obtained by simply replacingPt with the Pareto frontier over the
observed valuesYn.
Despite computingN box decompositions when selecting each candidatexi fori = 2,...,q , the CBD
approach reduces the time and space complexity from exponential (under the IEP ) to polynomial
inq (see Appendix D for details on time and space complexity). Figure 2 shows the total acquisition
optimization time (including box decompositions) for various batch sizes and demonstrates that using
CBD allows to scale to batch sizes that are completely infeasible when using IEP.
7 Optimizing NEHVI
Differentiability: Importantly, ˆαNEHVI (x) is differentiable w.r.t. x. Although determining the
Pareto frontier and computing the box decompositions are non-differentiable operations, these
operations do not involvex, even when re-sampling from the joint posteriorp(f(Xn,x)|Dn). Exact
sample-path gradients of∇x ˆαNEHVI (x) can easily be computed using auto-differentiation in modern
computational frameworks. This enables efﬁcient gradient-based optimization ofqNEHVI. 5
SAA Convergence Results: In addition to approximating the outer expectation over f(Xn) with
ﬁxed posterior samples, we can similarly ﬁx the base samples used for the new candidate point x.
This approach yields a deterministic acquisition function, which enables using (quasi-) higher-order
optimization methods to obtain fast convergence rates for acquisition optimization [2]. Importantly,
we prove that the theoretical convergence guarantees on acquisition optimization under the SAA
approach proposed by Balandat et al. [2] also hold for NEHVI.
Theorem 1. SupposeX is compact andf has a multi-output GP prior with continuously differen-
tiable mean and covariance functions. Let Xn ={xi}n
i=1 denote the previously evaluated points
and{ζ}N
t=1 be base samples ζ∼N (0,I (n+1)M). Let ˆαNEHVI denote the deterministic acquisi-
tion function computed using{ζ}N
t=1 as ˆαN
NEHVI and deﬁne S∗ := arg maxx∈XαNEHVI (x) to be
the set of maximizers of αNEHVI (x) overX . Suppose ˆx∗
N ∈ arg maxx∈X ˆαN
NEHVI (x). Then (1)
ˆαN
NEHVI (ˆx∗
N)→ αNEHVI (x∗
N) almost surely, and (2) dist(ˆx∗
N,S∗)→ 0, where dist(ˆx∗
N,S∗) :=
inf x∈S∗||ˆx∗
N−x|| is the Euclidean distance between ˆx∗
N and the setS∗.
Theorem 1 also holds in the parallel setting, soqNEHVI enjoys the same convergence guarantees as
NEHVI on acquisition optimization under the SAA. See Appendix E for further details and proof.
5One can also show that the gradient of the full MC estimator ˆαqNEHVI is an unbiased estimator of the
gradient of the true joint noisy expected hypervolume improvement αqNEHVI . However, this result is not
necessary for our SAA approach.
7

8 Approximation of qNEHVI using Approximate GP Sample Paths
Although CBD yields polynomial complexity ofqNEHVI with respect toq (rather than exponential
complexity with the IEP), it still requires computingN box decompositions and repeatedly evaluating
the joint posterior overf(Xn,{xj}i−1
j=1) for selecting each candidatexi fori = 1,...,q . A cheaper
alternative is to approximate the integral in (4) using a single approximate GP sample path ˜fi using
RFFs when optimizing candidatexi. A single-sample approximation ofqNEHVI, which we refer
to as qNEHVI-1 , can be computed by using ˜fi as the sampled GP in (6). Since the RFF is a
deterministic model, it is much less computationally expensive to evaluate than the GP posterior on
out-of-sample points, and exact gradients ofqNEHVI-1 with respect to current candidatexi can be
computed and used for efﬁcient multi-start optimization ofqNEHVI-1 using second-order gradient
methods.qNEHVI-1 requires CBD for efﬁcient sequential greedy batch selection and gradient-based
optimization, but does not use a sample average approximation for optimizing a new candidatexi;
instead, it uses an approximate sample path. See Rahimi & Recht [46] for details on RFFs.
qNEHVI-1 is related to TSEMO in that both use sequential greedy batch selection using HVI based
on RFF samples. However, TSEMO does not directly maximize HVI when selecting candidatexi,
wherei = 1,...,q ; rather, it relies on a heuristic approach of running NSGA-II on an RFF sample
of each objective to create a discrete population of candidates and then selecting the point from the
discrete population that maximizes HVI under the RFF sample. In contrast, qNEHVI-1 directly
optimizes HVI under the RFF using exact sample-path gradients, which leads to improved optimiza-
tion performance (see Appendix H). Furthermore, we ﬁnd that qNEHVI-1 is signiﬁcantly faster
than TSEMO, because rather than using NSGA-II it uses second order gradient methods to optimize
HVI (see Appendix H). Gradient-based optimization is only possible because CBD enables scalable,
differentiable HVI computation. While the primary goal of this work is to develop a principled,
scalable method for parallel EHVI in noisy environments, we include empirical comparisons with
qNEHVI-1 throughout the appendix to demonstrate the generalizablility of the CBD approach
and practical performance of theqNEHVI-1 approximation.qNEHVI-1 achieves the fastest batch
selection timesof any method tested on a GPU on every problem; in many cases, this is an order
of magnitude speed-up overqNEHVI . Moreover,qNEHVI-1 has a remarkable ability to scale to
large batch sizes when the dimensionality of optimization problem is modest. Further investigation of
qNEHVI-1 is needed, but we hope that the readers can recognize the ways in whichqNEHVI can
create broader opportunities for research into hypervolume improvement based acquisition functions.
9 Experiments
We empirically evaluateqNEHVI on a set of synthetic and real-world benchmark problems. We
compare it against the following recently proposed methods from the literature: PESMO, MESMO
(which we extend to the handle noisy observations using the noisy information gain from Takeno et al.
[52]), PFES, DGEMO, MOEA/D-EGO, TSEMO, TS-TCH,qEHVI (andqEHVI-PM-CBD , which
uses the posterior mean as a plug-in estimate for the function values at the in-sample points, along
with CBD to scale to large batch sizes), and qNParEGO. We optimize all methods using multi-start
L-BFGS-B with exact gradients (except for PFES, which uses gradients approximated via ﬁnite
differences), including TS-TCH where we optimize approximate function samples using RFFs with
500 basis functions. We model each outcome with an independent GP with a Matérn 5/2 ARD kernel
and infer the GP hyperparameters via maximum a posteriori (MAP) estimation. For all problems,
we assume that the noise variances are observed (except ABR, where we infer the noise level). See
Appendix G for more details on the experiments and acquisition function implementations.
We evaluate all methods using the logarithm of the difference in hypervolume between the true Pareto
frontier and the approximate Pareto frontier recovered by the algorithm. Since evaluations are noisy,
we compute the hypervolume dominated by the noiseless Pareto frontier across the observed points
for each method.
Synthetic Problems: We consider a noisy variants of the BraninCurrin problem (M = 2,d = 2)
and the DTLZ2 problem (M = 2,d = 6) [13], in which observations are corrupted with zero-mean
additive Gaussian noise with standard deviation of 5% of the range of each objective forBraninCurrin
and 10% for DTLZ2.
Adaptive Bitrate (ABR) Control Policy Optimization: ABR controllers are used for real-time
communication and media streaming applications. Policies for these controllers must be tuned to
8

0 50 100 150 200
Function Evaluations
0.00
0.25
0.50
0.75
1.00
1.25
1.50
1.75Log Hypervolume Difference
BraninCurrin
0 50 100 150 200
Function Evaluations
-1.10
-1.00
-0.90
-0.80
-0.70
-0.60
-0.50
-0.40
DTLZ2
0 50 100 150 200
Function Evaluations
4.80
5.00
5.20
5.40
5.60
5.80
ABR
0 50 100 150 200
Function Evaluations
-1.00
-0.50
0.00
0.50
1.00
VehicleSafety
DGEMO
MESMO
MOEA/D-EGO
PESMO
PFES
TS-TCH
TSEMO
qEHVI
qEHVI-PM-CBD
qNEHVI
qNEHVI-1
qNParEGO
Figure 3: Sequential optimization performance. The shaded region indicates two standard errors of
the mean over 100 replications (only 20 replications were feasible for PESMO due to large runtimes).
deliver a high quality of experience with respect to multiple objectives [40]. In industry settings, A/B
tests with dozens of policies are tested simultaneously since each policy may take days or weeks
to evaluate, producing noisy measurements across multiple objectives. In this experiment, we tune
policies to maximize video quality (bitrate) and minimize stall time. The policy hasd = 4 parameters,
which are detailed in Appendix G. We use the Park simulator [ 41] and sample a random set of
100 traces to obtain noisy measurements of the objectives under a given policy. For comparing the
performance of different methods, we estimate the true noiseless objective using mean objectives
across 300 traces. We infer a homoskedastic noise level jointly with the GP hyperparameters via
MAP estimation.
Vehicle Design Optimization: Optimizing the design of the frame an automobile is important to
maximizing passenger safety, vehicle durability and fuel efﬁciency. Evaluating a vehicle design
is time-consuming, since either a vehicle must manufactured and crashed, or a nonlinear ﬁnite
element-based crash analysis must be run to simulate a collision (which can take over 20 hours per
run) [62]. Hence, evaluating many designs in parallel is critical for reducing end-to-end optimization
time. Observations are often noisy due to manufacturing imperfections, measurement error, or
non-deterministic simulations. In this experiment, we tune thed = 5 widths of various components
of a vehicle’s frame to minimize proxy metrics for (1) fuel consumption, (2) passenger trauma in a
full frontal collison, and (3) vehicle fragility [53]. See Appendix G for details. For this demonstration,
we add zero-mean Gaussian noise with a standard deviation of 1% of the objective range, which
roughly corresponds to the manufacturing noise level used in previous work [62].
9.1 Summary of Results:
We ﬁnd thatqNEHVI andqNEHVI-1 outperform all other methods on the noisy benchmarks, both
in the sequential and parallel setting. In the sequential setting (Fig 3), qNEHVI andqNEHVI-1 are
followed closely byqEHVI -PM, and in some cases, evenqEHVI . TS-TCH is ﬁrmly in the middle
of the pack, while information-theoretic acquisition functions appear to perform the worst. This is
consistent across noise levels; for experiments where we add noise to the objectives, we consider
noise levels ranging from 1% to 10% of the range of each objective (these are magnitudes of the noise
often seen in practice). Previous works have only evaluated MOBO algorithms with noise levels of
1% [25]. In Appendix H, we perform a study showing thatqNEHVI consistently performs best with
increasing noise levels up to 30% of the range of each objective.
While parallel evaluation can provide optimization speedups on order of the batch size q, these
evaluations do affect the overall sample complexity of the algorithm, since less information is
available within the synchronous batch setting compared with fully sequential optimization. We
ﬁnd that, by and large, qNEHVI achieves the greatest hyper-volume for increasingly large batch
sizes, and scales more elegantly relative to TS-TCH and the ParEGO variants (Fig 4). qNEHVI
also consistently outperforms qEHVI -PM-CBD. In Appendix H, we observe that qNEHVI and
qNEHVI-1 provides excellent anytime performance all values ofq that we tested. We provide results
on 4 additional test problems in Appendix H.3, and in Appendix H.8, we demonstrate that leveraging
CBD and a single sample path approximation,qNEHVI-1 enables scaling to 5-objective problems,
which is a ﬁrst for an HVI-based method, to our knowledge.
9

1 8 16 32
q
-0.25
0.00
0.25
0.50
0.75
1.00
1.25
1.50
Log Hypervolume Difference
BraninCurrin
1 8 16 32
q
-1.10
-1.00
-0.90
-0.80
-0.70
-0.60
-0.50
DTLZ2
1 8 16 32
q
4.70
4.80
4.90
5.00
5.10
5.20
ABR
1 8 16 32
q
-1.00
-0.75
-0.50
-0.25
0.00
0.25
0.50
0.75
VehicleSafety
DGEMO
MOEA/D-EGO
TS-TCH
TSEMO
qEHVI
qEHVI-PM-CBD
qNEHVI
qNEHVI-1
qNParEGO
Figure 4: The quality of the ﬁnal Pareto frontier identiﬁed by each method with increasing batch
sizesq given a budget of 224 function evaluations. qEHVI is only included for q = 1 andq = 8
because the IEP scales exponential withq. DGEMO is omitted on the ABR problem because it was
prohibitively slow with time-consuming ABR simulations and on the VehicleSafety problem because
DGEMO consistently crashed in the graph cutting algorithm.
In our experiments, we ﬁnd that qNEHVI-1 is among the top performers on relatively low-
dimensional problems. Given the strong performance ofqNEHVI-1 , we examine its performance as
the dimensionality of the search space increases in Appendix H.5. We ﬁnd that qNEHVI is more
robust than qNEHVI-1 in higher-dimensional search spaces, but further investigation is needed
into how the number of the Fourier basis functions affects the performance ofqNEHVI-1 in high-
dimensional search spaces.
Optimization wall time: Across all experiments, we observe competitive wall times for optimizing
qNEHVI andqNEHVI-1 (all wall time comparisons are provided in Appendix H). On a GPU,
optimizingqNEHVI-1 incurs the lowest wall time of any method that we tested on every single
problem and optimizing qNEHVI is faster than optimizing information-theoretic methods on all
problems. Using efﬁcient low-rank Cholesky updates,qNEHVI is often faster than theqNParEGO
implementation in BoTorch on a GPU.
10 Discussion
We proposed NEHVI , a novel acquisition function that provides a principled approach to parallel
and noisy multi-objective Bayesian optimization. NEHVI is a one-step Bayes-optimal policy for
maximizing the hypervolume dominated by the Pareto frontier in noisy and noise-free settings.
NEHVI is made feasible by a new approach to computing joint hypervolumes ( CBD ), and we
demonstrated that CBD enables scalable, parallel candidate generation with both noiselessqEHVI
andqNEHVI . We provide theoretical results on optimizing a MC estimator ofqNEHVI using sample
average approximation and demonstrate signiﬁcant improvements in optimization performance over
state-of-the-art MOBO algorithms.
Yet, our work has some limitations. While the information-theoretic acquisition functions tested here
perform poorly on our benchmarks, they do allow for decoupled evaluations of different objectives in
cases where querying one objective may be more resource-intensive than querying other objectives.
Optimizing such acquisition functions is a non-trivial task, and it is possible that with improved
procedures, such acquisition functions could yield improved performance and provide a principled
approach to selecting evaluation sources on a budget. Although practically fast enough for most
Bayesian optimization tasks, exact hypervolume computation has super-polynomial complexity in the
number of objectives. CombiningqNEHVI with differentiable approximate methods for computing
hypervolume (e.g. Couckuyt et al. [9], Golovin & Zhang [23]) could lead to further speed-ups.
We hope that the core ideas presented in this work, including the CBD approach, can provide a
framework to support the development of new computationally efﬁcient MOBO methods.
10

References
[1] Asadpour, A., Nazerzadeh, H., and Saberi, A. Stochastic submodular maximization. In
Papadimitriou, C. and Zhang, S. (eds.), Internet and Network Economics . Springer Berlin
Heidelberg, 2008.
[2] Balandat, M., Karrer, B., Jiang, D. R., Daulton, S., Letham, B., Wilson, A. G., and Bakshy,
E. BoTorch: A Framework for Efﬁcient Monte-Carlo Bayesian Optimization. In Advances in
Neural Information Processing Systems 33, 2020.
[3] Belakaria, S., Deshwal, A., and Doppa, J. R. Max-value entropy search for multi-objective
bayesian optimization. In Advances in Neural Information Processing Systems 32, 2019.
[4] Binois, M., Ginsbourger, D., and Roustant, O. Quantifying uncertainty on pareto fronts with
gaussian process conditional simulations. Eur. J. Oper. Res., 243:386–394, 2015.
[5] Bradford, E., Schweidtmann, A. M., and Lapkin, A. Efﬁcient multiobjective optimization
employing gaussian processes, spectral sampling and a genetic algorithm. Journal of global
optimization, 71(2):407–438, 2018.
[6] Brockhoff, D., Tusar, T., Auger, A., and Hansen, N. Using well-understood single-objective
functions in multiobjective black-box optimization test suites, 2019.
[7] Calandra, R. and Peters, J. Pareto front modeling for sensitivity analysis in multi-objective
bayesian optimization. 2014.
[8] Calandra, R., Seyfarth, A., Peters, J., and Deisenroth, M. P. Bayesian optimization for learning
gaits under uncertainty. Annals of Mathematics and Artiﬁcial Intelligence , 76(1):5–23, Feb
2016. ISSN 1573-7470. doi: 10.1007/s10472-015-9463-9.
[9] Couckuyt, I., Deschrijver, D., and Dhaene, T. Towards efﬁcient multiobjective optimization:
Multiobjective statistical criterions. In 2012 IEEE Congress on Evolutionary Computation, pp.
1–8, 2012.
[10] Daulton, S., Singh, S., Avadhanula, V ., Dimmery, D., and Bakshy, E. Thompson sampling for
contextual bandit problems with auxiliary safety constraints. In NeurIPS Workshop on Safety
and Robustness in Decision Making, 2019.
[11] Daulton, S., Balandat, M., and Bakshy, E. Differentiable expected hypervolume improvement for
parallel multi-objective Bayesian optimization. In Advances in Neural Information Processing
Systems 33, NeurIPS, 2020.
[12] Deb, K., Pratap, A., Agarwal, S., and Meyarivan, T. A fast and elitist multiobjective genetic
algorithm: Nsga-ii. IEEE Transactions on Evolutionary Computation, 6(2):182–197, 2002.
[13] Deb, K., Thiele, L., Laumanns, M., and Zitzler, E. Scalable multi-objective optimization
test problems. volume 1, pp. 825–830, 06 2002. ISBN 0-7803-7282-4. doi: 10 .1109/
CEC.2002.1007032.
[14] Deb, K., Gupta, S., Daum, D., Branke, J., Mall, A. K., and Padmanabhan, D. Reliability-based
optimization using evolutionary algorithms. IEEE Transactions on Evolutionary Computation,
13(5):1054–1074, 2009. doi: 10.1109/TEVC.2009.2014361.
[15] Dächert, K., Klamroth, K., Lacour, R., and Vanderpooten, D. Efﬁcient computation of the
search region in multi-objective optimization. European Journal of Operational Research, 260
(3):841 – 855, 2017.
[16] Emmerich, M. T. M., Giannakoglou, K. C., and Naujoks, B. Single- and multiobjective
evolutionary optimization assisted by gaussian random ﬁeld metamodels. IEEE Transactions
on Evolutionary Computation, 10(4):421–439, 2006.
[17] Feng, Q., Letham, B., Bakshy, E., and Mao, H. High-Dimensional Contextual Policy Search with
Unknown Context Rewards using Bayesian Optimization. In Advances in Neural Information
Processing Systems 33, 2020.
[18] Fisher, M. L., Nemhauser, G. L., and Wolsey, L. A. An analysis of approximations for
maximizing submodular set functions—II , pp. 73–87. Springer Berlin Heidelberg, Berlin,
Heidelberg, 1978.
[19] Frazier, P. I. A tutorial on bayesian optimization. arXiv preprint arXiv:1807.02811, 2018.
11

[20] Garrido-Merchán, E. C. and Hernández-Lobato, D. Predictive entropy search for multi-objective
bayesian optimization with constraints. Neurocomputing, 361:50–68, 2019.
[21] Garrido-Merchán, E. C. and Hernández-Lobato, D. Parallel predictive entropy search for
multi-objective bayesian optimization with constraints, 2020.
[22] Gelbart, M. A., Snoek, J., and Adams, R. P. Bayesian optimization with unknown constraints.
In Proceedings of the 30th Conference on Uncertainty in Artiﬁcial Intelligence, UAI, 2014.
[23] Golovin, D. and Zhang, Q. Random hypervolume scalarizations for provable multi-objective
black box optimization, 2020.
[24] Hernández-Lobato, J. M., Hoffman, M. W., and Ghahramani, Z. Predictive entropy search for
efﬁcient global optimization of black-box functions. In Proceedings of the 27th International
Conference on Neural Information Processing Systems - Volume 1 , NIPS’14, pp. 918–926,
Cambridge, MA, USA, 2014. MIT Press.
[25] Hernández-Lobato, D., Hernández-Lobato, J. M., Shah, A., and Adams, R. P. Predictive entropy
search for multi-objective bayesian optimization, 2015.
[26] Horn, D., Dagge, M., Sun, X., and Bischl, B. First investigations on noisy model-based multi-
objective optimization. volume 10173, pp. 298–313, 02 2017. ISBN 978-3-319-54156-3. doi:
10.1007/978-3-319-54157-0_21.
[27] Igel, C., Hansen, N., and Roth, S. Covariance matrix adaptation for multi-objective optimization.
Evolutionary Computation, 15(1):1–28, 2007. doi: 10.1162/evco.2007.15.1.1.
[28] Jiang, S., Zhang, H., Cong, W., Liang, Z., Ren, Q., Wang, C., Zhang, F., and Jiao, X. Multi-
objective optimization of smallholder apple production: Lessons from the bohai bay region.
Sustainability, 12(16):6496, 2020.
[29] Jones, D. R., Schonlau, M., and Welch, W. J. Efﬁcient global optimization of expensive
black-box functions. Journal of Global Optimization, 13:455–492, 1998.
[30] Kingma, D. P. and Welling, M. Auto-Encoding Variational Bayes. arXiv e-prints , pp.
arXiv:1312.6114, Dec 2013.
[31] Klamroth, K., Lacour, R., and Vanderpooten, D. On the representation of the search region
in multi-objective optimization. European Journal of Operational Research, 245(3):767–778,
Sep 2015. ISSN 0377-2217. doi: 10 .1016/j.ejor.2015.03.031. URL http://dx.doi.org/
10.1016/j.ejor.2015.03.031.
[32] Knowles, J. Parego: a hybrid algorithm with on-line landscape approximation for expensive
multiobjective optimization problems. IEEE Transactions on Evolutionary Computation, 10(1):
50–66, 2006.
[33] Koch, P., Wagner, T., Emmerich, M. T., Back, T., and Konen, W. Efﬁcient multi-criteria
optimization on noisy machine learning problems. Appl. Soft Comput., 29(C):357–370, April
2015. ISSN 1568-4946. doi: 10.1016/j.asoc.2015.01.005. URL https://doi.org/10.1016/
j.asoc.2015.01.005.
[34] Lacour, R., Klamroth, K., and Fonseca, C. M. A box decomposition algorithm to compute the
hypervolume indicator. Computers & Operations Research, 79:347 – 360, 2017.
[35] LeCun, Y ., Cortes, C., and Burges, C. Mnist handwritten digit database.ATT Labs [Online].
Available: http://yann.lecun.com/exdb/mnist, 2, 2010.
[36] Letham, B. and Bakshy, E. Bayesian optimization for policy search via online-ofﬂine ex-
perimentation. Journal of Machine Learning Research , 20(145):1–30, 2019. URL http:
//jmlr.org/papers/v20/18-225.html.
[37] Letham, B., Karrer, B., Ottoni, G., and Bakshy, E. Constrained bayesian optimization with
noisy experiments. Bayesian Analysis, 14(2):495–519, 06 2019. doi: 10.1214/18-BA1110.
[38] Liao, T., Wang, G., Yang, B., Lee, R., Pister, K., Levine, S., and Calandra, R. Data-efﬁcient
learning of morphology and controller for a microrobot. In 2019 International Conference on
Robotics and Automation (ICRA), pp. 2488–2494. IEEE, 2019.
[39] Lukovic, K. M., Tian, Y ., and Matusik, W. Diversity-guided multi-objective bayesian opti-
mization with batch evaluations. Advances in Neural Information Processing Systems , 33,
2020.
12

[40] Mao, H., Chen, S., Dimmery, D., Singh, S., Blaisdell, D., Tian, Y ., Alizadeh, M., and Bakshy, E.
Real-world video adaptation with reinforcement learning. 2019.
[41] Mao, H., Negi, P., Narayan, A., Wang, H., Yang, J., Wang, H., Marcus, R., Addanki, R.,
Shirkoohi, M. K., He, S., Nathan, V ., Cangialosi, F., Venkatakrishnan, S. B., Weng, W.-H., Han,
S.-W., Kraska, T., and Alizadeh, M. Park: An open platform for learning-augmented computer
systems. In NeurIPS, 2019.
[42] Mennen, S. M., Alhambra, C., Allen, C. L., Barberis, M., Berritt, S., Brandt, T. A., Campbell,
A. D., Castañón, J., Cherney, A. H., Christensen, M., Damon, D. B., Eugenio de Diego,
J., García-Cerrada, S., García-Losada, P., Haro, R., Janey, J., Leitch, D. C., Li, L., Liu, F.,
Lobben, P. C., MacMillan, D. W. C., Magano, J., McInturff, E., Monfette, S., Post, R. J.,
Schultz, D., Sitter, B. J., Stevens, J. M., Strambeanu, I. I., Twilton, J., Wang, K., and Zajac,
M. A. The evolution of high-throughput experimentation in pharmaceutical development and
perspectives on the future. Organic Process Research & Development, 23(6):1213–1242, 2019.
doi: 10.1021/acs.oprd.9b00140.
[43] Namkoong, H., Daulton, S., and Bakshy, E. Distilled thompson sampling: Practical and
efﬁcient thompson sampling via imitation learning. In NeurIPS Ofﬂine Reinforcement Learning
Workshop, 2020.
[44] Osborne, M. A. Bayesian gaussian processes for sequential prediction, optimisation and
quadrature. 2010.
[45] Paria, B., Kandasamy, K., and Póczos, B. A Flexible Multi-Objective Bayesian Optimization
Approach using Random Scalarizations. ArXiv e-prints, May 2018.
[46] Rahimi, A. and Recht, B. Random features for large-scale kernel machines. In Proceedings
of the 20th International Conference on Neural Information Processing Systems, NIPS’07, pp.
1177–1184, Red Hook, NY , USA, 2007. Curran Associates Inc. ISBN 9781605603520.
[47] Rasmussen, C. E. Gaussian Processes in Machine Learning , pp. 63–71. Springer Berlin
Heidelberg, Berlin, Heidelberg, 2004.
[48] Real, E., Aggarwal, A., Huang, Y ., and Le, Q. V . Regularized evolution for image classiﬁer
architecture search. Proceedings of the AAAI Conference on Artiﬁcial Intelligence , 33(01):
4780–4789, Jul. 2019. doi: 10.1609/aaai.v33i01.33014780. URL https://ojs.aaai.org/
index.php/AAAI/article/view/4405.
[49] Schuster, M. Speech recognition for mobile devices at google. In Zhang, B.-T. and Orgun,
M. A. (eds.), PRICAI 2010: Trends in Artiﬁcial Intelligence, pp. 8–10, Berlin, Heidelberg, 2010.
Springer Berlin Heidelberg. ISBN 978-3-642-15246-7.
[50] Shahriari, B., Swersky, K., Wang, Z., Adams, R. P., and de Freitas, N. Taking the human out of
the loop: A review of bayesian optimization. Proceedings of the IEEE, 104(1):148–175, 2016.
[51] Suzuki, S., Takeno, S., Tamura, T., Shitara, K., and Karasuyama, M. Multi-objective
Bayesian optimization using pareto-frontier entropy. In III, H. D. and Singh, A. (eds.), Pro-
ceedings of the 37th International Conference on Machine Learning , volume 119 of Pro-
ceedings of Machine Learning Research , pp. 9279–9288. PMLR, 13–18 Jul 2020. URL
http://proceedings.mlr.press/v119/suzuki20a.html.
[52] Takeno, S., Fukuoka, H., Tsukada, Y ., Koyama, T., Shiga, M., Takeuchi, I., and Karasuyama, M.
Multi-ﬁdelity Bayesian optimization with max-value entropy search and its parallelization. In
III, H. D. and Singh, A. (eds.), Proceedings of the 37th International Conference on Machine
Learning, volume 119 of Proceedings of Machine Learning Research, pp. 9334–9345. PMLR,
13–18 Jul 2020. URL http://proceedings.mlr.press/v119/takeno20a.html.
[53] Tanabe, R. and Ishibuchi, H. An easy-to-use real-world multi-objective optimization problem
suite. Applied Soft Computing, 89:106078, 2020. ISSN 1568-4946. doi: https://doi.org/10.1016/
j.asoc.2020.106078.
[54] Thompson, W. R. On the likelihood that one unknown probability exceeds another in view of
the evidence of two samples. Biometrika, 25(3/4):285–294, 1933.
[55] Touré, C., Hansen, N., Auger, A., and Brockhoff, D. Uncrowded hypervolume improvement:
Como-cma-es and the sofomore framework. In Proceedings of the Genetic and Evolutionary
Computation Conference, GECCO ’19, pp. 638–646, New York, NY , USA, 2019. Association
for Computing Machinery. ISBN 9781450361118. doi: 10 .1145/3321707.3321852. URL
https://doi.org/10.1145/3321707.3321852.
13

[56] Wang, R., Xiong, J., Ishibuchi, H., Wu, G., and Zhang, T. On the effect of reference
point in moea/d for multi-objective optimization. Applied Soft Computing , 58:25–34,
2017. ISSN 1568-4946. doi: https://doi .org/10.1016/j.asoc.2017.04.002. URL https:
//www.sciencedirect.com/science/article/pii/S1568494617301722.
[57] Wilson, J., Hutter, F., and Deisenroth, M. Maximizing acquisition functions for bayesian
optimization. In Advances in Neural Information Processing Systems 31, pp. 9905–9916. 2018.
[58] Yang, K., Emmerich, M., Deutz, A., and Bäck, T. Multi-objective bayesian global optimization
using expected hypervolume improvement gradient. Swarm and Evolutionary Computation, 44:
945 – 956, 2019. ISSN 2210-6502. doi: https://doi.org/10.1016/j.swevo.2018.10.007.
[59] Yang, K., Emmerich, M., Deutz, A. H., and Bäck, T. Efﬁcient computation of expected
hypervolume improvement using box decomposition algorithms. CoRR, abs/1904.12672, 2019.
[60] Yang, K., Palar, P., Emmerich, M., Shimoyama, K., and Bäck, T. A multi-point mechanism of
expected hypervolume improvement for parallel multi-objective bayesian global optimization.
pp. 656–663, 07 2019. doi: 10.1145/3321707.3321784.
[61] Yang, K., Palar, P. S., Emmerich, M., Shimoyama, K., and Bäck, T. A multi-point mech-
anism of expected hypervolume improvement for parallel multi-objective bayesian global
optimization. In Proceedings of the Genetic and Evolutionary Computation Conference ,
GECCO ’19, pp. 656–663, New York, NY , USA, 2019. Association for Computing Machinery.
ISBN 9781450361118. doi: 10.1145/3321707.3321784. URL https://doi.org/10.1145/
3321707.3321784.
[62] Youn, B. D., Choi, K., Yang, R.-J., and Gu, L. Reliability-based design optimization for
crashworthiness of vehicle side impact. Structural and Multidisciplinary Optimization , 26:
272–283, 02 2004. doi: 10.1007/s00158-003-0345-0.
[63] Zhang, G. and Block, D. E. Using highly efﬁcient nonlinear experimental design methods for
optimization of lactococcus lactis fermentation in chemically deﬁned media. Biotechnology
progress, 25(6):1587–1597, 2009.
[64] Zhang, Q., Liu, W., Tsang, E., and Virginas, B. Expensive multiobjective optimization by
moea/d with gaussian process model. IEEE Transactions on Evolutionary Computation, 14(3):
456–474, 2010. doi: 10.1109/TEVC.2009.2033671.
[65] Zhou, A., Zhang, Q., and Zhang, G. A multiobjective evolutionary algorithm based on decom-
position and probability model. In 2012 IEEE Congress on Evolutionary Computation, pp. 1–8,
2012. doi: 10.1109/CEC.2012.6252954.
[66] Zitzler, E., Deb, K., and Thiele, L. Comparison of multiobjective evolutionary algorithms:
Empirical results. Evol. Comput., 8(2):173–195, June 2000. ISSN 1063-6560. doi: 10.1162/
106365600568202. URL https://doi.org/10.1162/106365600568202.
[67] Zitzler, E., Deb, K., and Thiele, L. Comparison of multiobjective evolutionary algorithms:
Empirical results. Evolutionary computation, 8(2):173–195, 2000.
14