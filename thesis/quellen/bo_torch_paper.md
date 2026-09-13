# bo_torch_paper

Quelle: C:\Users\Felix\Desktop\Master\Thesis\Quellen\ML\bo_torch_paper.pdf

---
BOTORCH : Bayesian Optimization in PyTorch
Maximilian Balandat
Facebook
balandat@fb.com
Brian Karrer
Facebook
briankarrer@fb.com
Daniel R. Jiang
Facebook
drjiang@fb.com
Samuel Daulton
Facebook
sdaulton@fb.com
Benjamin Letham
Facebook
bletham@fb.com
Andrew Gordon Wilson
New York University
andrewgw@cims.nyu.edu
Eytan Bakshy
Facebook
ebakshy@fb.com
Abstract
Bayesian optimization provides sample-efﬁcient global optimization for a broad
range of applications, including automatic machine learning, engineering, physics,
and experimental design. We introduce BOTORCH , a modern programming frame-
work for Bayesian optimization that combines Monte-Carlo (MC) acquisition
functions, a novel sample average approximation optimization approach, auto-
differentiation, and variance reduction techniques. BOTORCH ’s modular design
facilitates ﬂexible speciﬁcation and optimization of probabilistic models written in
PyTorch, simplifying implementation of new acquisition functions. Our approach
is backed by novel theoretical convergence results and made practical by a distinc-
tive algorithmic foundation that leverages fast predictive distributions, hardware
acceleration, and deterministic optimization. In experiments, we demonstrate the
improved sample efﬁciency of BOTORCH relative to other popular libraries.
1 Introduction
Computational modeling and machine learning (ML) have led to an acceleration of scientiﬁc in-
novation in diverse areas, ranging from drug design to robotics to optical physics. These tasks
often involve solving time- and resource-intensive global optimization problems to achieve optimal
performance. Bayesian optimization (BO) [ 68, 44, 69], an established methodology for sample-
efﬁcient sequential optimization, has been proposed as an effective solution to such problems, and
has been applied successfully to tasks ranging from hyperparameter optimization [ 23, 86, 104],
robotic control [14, 5], chemical design [36, 56, 105], and tuning and policy search for internet-scale
software systems [4, 55, 54]. Meanwhile, the broader ﬁeld of ML has been undergoing a revolution
driven largely by new programming frameworks and hardware that reduce the time from ideation
to execution [42, 15, 1, 74]. While BO has become rich with new methodologies, today there is no
coherent framework that leverages these computational advances to simplify and accelerate research
in the same way that modern deep learning frameworks have for ML.
In this paper, we close this gap by introducing BOTORCH , a modular and scalable Monte Carlo (MC)
framework for BO that is built around modern paradigms of computation, and theoretically grounded
in novel convergence results. Our contributions include:
• A novel approach to optimizing MC acquisition functions that effectively combines with determin-
istic higher-order optimization algorithms and variance reduction techniques.
• The ﬁrst convergence results for sample average approximation (SAA) of MC acquisition functions.
• A set of composable model-agnostic abstractions for MC BO that leverage modern computational
frameworks, including auto-differentiation and scalable parallel computation on CPUs and GPUs.
• A new “one-shot” formulation of the Knowledge Gradient, a powerful look-ahead acquisition
function known to be difﬁcult to implement, with improved performance over the state-of-the-art.
arXiv:1910.06403v2  [cs.LG]  4 Jun 2020

2 Background and Related Work
In BO, we aim to solve maxx∈Xftrue(x), where ftrue is an expensive-to-evaluate function and
X⊂ Rd is a feasible set. BO consists of two main components: a probabilistic surrogate model
of the observed function—most commonly, a Gaussian process (GP)—and an acquisition function
that encodes a strategy for navigating the exploration vs. exploitation trade-off [ 86]. Taking a
model-agnostic view, our focus in this paper is on MC acquisition functions.
Popular libraries for BO include Spearmint [ 88], GPyOpt [ 92], Cornell-MOE [ 99], RoBO [ 50],
Emukit [91], and Dragonﬂy [47]. We provide further discussion of these packages in Appendix A.
Two other libraries, ProBO [66] and GPFlowOpt [53], are of particular relevance. ProBO is a recently
suggested framework1 for using general probabilistic programming in BO. While its distribution-
agnostic approach is similar to ours, ProBO, unlike BOTORCH , does not beneﬁt from gradient-based
optimization provided by differentiable programming, or algebraic methods designed to exploit
GPU acceleration. GPFlowOpt inherits support for auto-differentiation and hardware acceleration
from TensorFlow [via GPFlow,59], but unlike BOTORCH , it does not use algorithms designed to
speciﬁcally exploit this potential. Neither ProBO nor GPFlowOpt naturally support MC acquisition
functions. In contrast to all existing libraries, BOTORCH is a modular programming framework and
employs novel algorithmic approaches that achieve a high degree of ﬂexibility and performance.
The MC approach to optimizing acquisition functions has been considered in the BO literature to
an extent, typically using stochastic methods for optimization (see e.g., Wang et al. [94], Wu and
Frazier [99], Wu et al. [103], Wilson et al. [97]). Our work takes the distinctive view of sample
average approximation (SAA), an approach that combines sampling with deterministic optimization
and variance reduction techniques. To our knowledge, we provide the ﬁrst theoretical analysis and
systematic implementation of this approach in the BO setting.
3 Monte-Carlo (MC) Acquisition Functions
We begin by describing a general formulation of BO in the context of MC acquisition functions.
Suppose we have collected dataD ={(xi,yi)}n
i=1, wherexi∈ X andyi =ftrue(xi) +vi(xi) with
vi some noise corrupting the true function value ftrue(xi). We allow ftrue to be multi-output, in
which caseyi,vi∈ Rm. In some applications we may also have access to distributional information
of the noise vi, such as its (possibly heteroskedastic) variance. Suppose further that we have
a probabilistic surrogate model f that for any x := {x1,...,x q} provides a distribution over
f(x) := (f(x1),...,f (xq)) andy(x) := (y(x1),...,y (xq)). We denote byfD(x) andyD(x) the
respective posterior distributions conditioned on dataD. In BO, the modelf traditionally is a GP, and
thevi are assumed i.i.d. normal, in which case bothfD(x) andyD(x) are multivariate normal. The
MC framework considered here makes no particular assumptions about the form of these posteriors.
The next step in BO is to optimize an acquisition function evaluated onfD(x) over the candidate
set x. Following Wilson et al. [98], Bect et al. [7], many acquisition functions can be written as
α(x; Φ,D) = E
[
a(g(f(x)), Φ)|D
]
, (1)
whereg : Rq×m→ Rq is a (composite) objective function, Φ∈Φ are parameters independent of x,
anda : Rq× Φ→ R is a utility function that deﬁnes the acquisition function.
In some situations, the expectation overfD(x) in (1) and its gradient∇xα(x; Φ,D) can be computed
analytically, e.g. if one considers a single-output (m=1) model, a single candidate (q =1) pointx, a
Gaussian posteriorfD(x) =N (µx,σ 2
x), and the identity objectiveg(f)≡f. Expected Improvement
(EI) is a popular acquisition function that maximizes the expected difference between the currently
observed best valuef∗ (assuming noiseless observations) andf at the next query point, through the
utilitya(f;f∗) = max(f−f∗, 0). EI and its gradient have a well-known analytic form [44].
In general, analytic expressions are not available for arbitrary objective functionsg(·), utility functions
a(·,·), non-Gaussian model posteriors, or collections of points x which are to be evaluated in a
parallel or asynchronous fashion [32, 88, 99, 94, 97]. Instead, using samples from the posterior, MC
integration can be used to approximate the expectation(1). An MC approximation ˆαN(x; Φ,D) of (1)
1No implementation of ProBO is available at the time of this writing.
2

Model
Sampler
Posterior
OBSERVATIONS
CANDIDATE 
SET
EXPECTED
UTILITY OF THE-
CANDIDATE SET
MONTE-CARLO ACQUISITION FUNCTION
Objective
Utility
Figure 1: MC acquisition functions. Samples ξi
D from the posteriorfD(x)provided by the modelf at x are
evaluated in parallel and averaged as in (2). All operations are fully differentiable.
usingN samplesξi
D(x)∼fD(x) is straightforward:
ˆαN(x; Φ,D) = 1
N
N∑
i=1
a(g(ξi
D(x)), Φ). (2)
The obvious way to evaluate (2) is to draw i.i.d. samples ξi
D(x). Alternatively, randomized quasi-
Monte Carlo (RQMC) techniques [13] can be used to signiﬁcantly reduce the variance of the estimate
and its gradient (see Appendix E for additional details).
4 MC Bayesian Optimization via Sample Average Approximation
Effectively optimizing the acquisition functionα, especially in higher dimensions, typically requires
using gradient information. For differentiable analytic acquisition functions (e.g. EI, UCB), one can
either manually implement gradients, or use auto-differentiation to compute∇xα(x; Φ,D), provided
one can differentiate through the posterior parameters (which is the case e.g. for Gaussian posteriors).
For MC acquisition functions, an unbiased estimate of∇xα(x; Φ,D) can often be obtained from (2)
via the reparameterization trick [ 48, 79]. The basic idea is that ξ∼ fD(x) can be expressed as a
suitable (differentiable) deterministic transformationξ =hD(x,ϵ ) of an auxiliary random variableϵ
independent of x. For instance, iffD(x)∼N (µx, Σx), thenhD(x,ϵ ) =µx+Lxϵ, withϵ∼N (0,I )
andLxLT
x = Σx. Ifa(·, Φ) andg(·) are differentiable, then∇xa(g(ξ), Φ) =∇ga∇ξg∇xhD(x,ϵ ).
Our primary methodological contribution is to take a sample average approximation [51] view of
BO. The conventional approach to optimizing MC acquisition functions of the form (2) is to re-draw
samples from ϵ for each evaluation and apply stochastic ﬁrst-order methods such as Stochastic
Gradient Descent (SGD) [ 98]. In our SAA approach, rather than re-drawing samples from ϵ for
each evaluation of the acquisition function, we draw a set of base samples E :={ϵi}N
i=1 once,
and hold it ﬁxed between evaluations throughout the course of optimization (this can be seen as a
speciﬁc incarnation of the method of common random numbers). Conditioned onE, the resulting
MC estimate ˆαN(x; Φ,D) is deterministic. We then obtain the candidate set ˆx∗
N as
ˆx∗
N∈ arg max
x∈Xq
ˆαN(x; Φ,D). (3)
The gradient∇x ˆαN(x; Φ,D) can be computed as the average of the sample-level gradients, exploiting
auto-differentiation. We emphasize that whether this average is a “proper” (i.e., unbiased, consistent)
estimator of∇xα(x; Φ,D) is irrelevant for the convergence results we will derive below.
While the convergence properties of MC integration are well-studied [13], the respective literature
on SAA (i.e., convergence of the optimizer (3) itself) is far less comprehensive. Here, we derive
what, to the best of our knowledge, are the ﬁrst SAA convergence results for (RQ)MC acquisition
functions in the context of BO. To simplify our exposition, we limit ourselves to GP surrogates and
i.i.d. base samples; more general (incl. RQMC) results and proofs are presented in Appendix D. For
notational simplicity, we will drop the dependence ofα and ˆαN on Φ andD for the remainder of this
section. Letα∗ := maxx∈Xqα(x), and denote byX∗ the associated set of maximizers. Similarly, let
ˆα∗
N := maxx∈Xq ˆαN(x). With this we have the following key result:
Theorem 1. Suppose (i) X is compact, (ii)f has a GP prior with continuously differentiable mean
and covariance functions, and (iii) g(·) anda(·, Φ) are Lipschitz continuous. If the base samples
{ϵi}N
i=1 are i.i.d.N (0, 1), then (1) ˆα∗
N→α∗ a.s., and (2) dist(ˆx∗
N,X∗)→ 0 a.s.. Under additional
regularity conditions, (3)∀δ >0,∃K <∞,α> 1 s.t. P
(
dist(ˆx∗
N,X∗)>δ
)
≤Ke−αN,∀N≥ 1.
3

Under relatively weak conditions,2 Theorem 1 ensures not only that the optimizerˆx∗
N of ˆαN converges
to an optimizer of the true α with probability one, but also that the convergence (in probability)
happens at an exponential rate. We stated Theorem 1 informally and for i.i.d. base samples for
simplicity. In Appendix D.3 we give a formal statement, and extend it to base samples generated by a
family of RQMC methods, leveraging recent theoretical advances [72]. While at this point we do not
characterize improvements in theoretical convergence rates of RQMC over MC for SAA, we observe
that RQMC methods work remarkably well in practice (see Figures 2 and 3).
0.0
0.1
0.2
0.3EI
MC, n=32
analytic
qMC, n=32
analytic
0.0 0.2 0.4 0.6 0.8 1.0
0.0
0.1
0.2
0.3EI
MC, n=32 (fixed)
analytic
0.0 0.2 0.4 0.6 0.8 1.0
qMC, n=32 (fixed)
analytic
Figure 2: MC and QMC acquisition functions, with and with-
out (“ﬁxed”) re-drawing base samples between evaluations.
The model is a GP ﬁt on 15 points randomly sampled from
X = [0, 1]6 and evaluated on the Hartmann6 function. Evalu-
ation is along the slicex(λ) =λ1.
16 64 256 1024 4096
N
35
30
25
20
15
10
5
log2E[||x *
N x * ||2
2]
MC/uni00A0(SAA)
MC/uni00A0(re/uni00ADsample)
qMC/uni00A0(SAA)
qMC/uni00A0(re/uni00ADsample)
Figure 3: Empirical convergence rates of the
optimizer for EI using MC / QMC sampling
under SAA / stochastic optimization (“re-
sample”). Appendix E provides additional
detail and discussion.
The primary beneﬁt from SAA comes from the fact that in order to optimize ˆαN(x; Φ,D) for ﬁxed
base samples E, one can now employ the full toolbox of deterministic optimization, including
quasi-Newton methods that provide faster convergence speeds and are generally less sensitive to
optimization hyperparameters than stochastic ﬁrst-order methods. By default, we use multi-start
optimization via L-BFGS-B in conjunction with an initialization heuristic that exploits fast batch
evaluation of acquisition functions (see Appendix G.1). We ﬁnd that in practice the bias from using
SAA only has a minor effect on the performance relative to using the analytic ground truth, and often
improves performance relative to stochastic approaches (see Appendix E), while avoiding tedious
tuning of optimization hyperparameters such as learning rates.
5 Programmable Bayesian Optimization with B OTORCH
We condensed the above insights into BOTORCH , a ﬂexible programming framework for MC-based
BO research implemented in PyTorch. AtBOTORCH ’s core lies a set of modular abstractions, inspired
by the components in Figure 1, that allow to succinctly represent and implement state-of-the-art BO
procedures. All operations in the modules are highly parallelizable on modern hardware and end-
to-end differentiable, which allows for efﬁcient optimization of acquisition functions. BOTORCH ’s
ﬂexibility and optimization performance is uniquely enabled by—but not limited to—our distinct
SAA approach. Since the chain of evaluations on the sample level does not make any assumptions
about the form of the posterior, BOTORCH ’s primitives can be directly used with any model from
which re-parameterized posterior samples can be drawn, including probabilistic programs [93, 8],
Bayesian neural networks [65, 81, 57, 41], and more general types of Gaussian processes [18, 28].
BOTORCH provides the following abstractions for combining BO primitives:
Models: A Model f is a PyTorch module implementing a Bayesian model. In this work, we
focus on an efﬁcient and scalable implementation of GPs [28]. Models implement a posterior(x,
observation_noise=False) method that, given x, returns a Posterior object representingfD(x)
(oryD(x), if observation_noise=True). Models may also implement a fantasize(x, sampler)
method that, given x and an MCSampler sampler , constructs a batched set of N fantasy models
{fi}N
i=1 s.t. fi
D(x)
d
= fDix(x),∀ x∈ Xq, whereDi
x :=D∪{ x,yi
D(x)}. These fantasy models
provide a distribution over possible functions conditioned on future observations at x, which can be
used to implement look-ahead strategies [31, 100] and “sequential greedy” optimization [88].
Posteriors: A Posterior is a container for the model posterior fD(x) at the candidate set x. A
Posterior may be be explicit (e.g. a multivariate normal in the case of GPs), or implicit (e.g. a
2Many utility functionsa are Lipschitz, including those representing (parallel) EI and UCB [97]. Lipschitzness
is a sufﬁcient condition, and convergence can also be shown in less restrictive settings (see Appendix D).
4

container for a warmed-up MCMC chain). Posteriors implement an rsample(Ns, E) method
that, given base samplesE∈ RNs×qm, producesNs samplesξD∈ RNs×q×m from the joint posterior.
Samplers: An MCSampler employs the reparameterization trick [ 48, 79] to draw samples from a
posterior p. Its forward(p) pass draws samples ξi
D from p by automatically constructing base
samplesE. By default, B OTORCH uses RQMC based on scrambled Sobol sequences [71].
Objectives: An Objective is a module whose forward(ξ) pass applies a transformation g(·) to
samples ξ from a posterior. For instance, an Objective may scalarize outputs for multi-output
models for multi-objective optimization [73] or implement composite objectives [6]. In this work, we
also propose a sample-level differentiable relaxation of a feasibility-weighted improvement criterion
that generically supports unknown (and to-be-modeled) outcome constraints [83, 27, 30, 55].
Acquisition functions: An AcquisitionFunction combines model, sampler, and objective into
a single module, whose forward pass assigns a utility α(x) to a candidate set x. With the above
components, deﬁning a new MC acquisition function in BOTORCH only requires implementing the
utility functiona and averaging across MC samples.
The MC formulation enables BOTORCH to support both parallel and asynchronous BO in a generic
fashion. In asynchronous candidate generation, a set of ˜x of pending points have been submitted
for evaluation, but have not yet completed. This can be handled by appropriately augmenting the
candidate set: We compute the joint utilityα(x∪ ˜x; Φ,D) of all points, pending and new, but optimize
only with respect to the new x. BOTORCH provides a @concatenate_pending_points decorator to
add this functionality to any MC acquisition function. This also provides a natural way of generating
parallel BO candidates using sequential greedy optimization [88] (see Appendix G.2).
5.1 Implementation Examples
To demonstrate the core components of BOTORCH , we show how both existing approaches and
novel acquisition functions. Additional examples, including active learning with scalable Gaussian
processes, are given in Appendix F.
Composite Objectives: In some applications, the objective is a known function of one or more
outcomes. Astudillo and Frazier [6] show that modeling such individual components can be advanta-
geous. They propose the use of composite functions and develop a MC-based variant of EI, EI-CF.
This is a special case of BOTORCH ’sObjective abstraction, and can be readily implemented as such.
For instance, extending the simulation calibration example from [6] to use the Knowledge Gradient
(KG) acquisition function is achieved simply by passing a multi-output model and an appropriate
Objective module (here computing the MSE) to the KG constructor:
o b j = GenericMCObjective ( lambda Y: −(Y− c_obs ) . pow ( 2 ) . sum ( dim=−1) )
qKG = qKnowledgeGradient ( model=model , o b j e c t i v e = o b j )
In Appendix H.1, we show that this extension yields performance superior to that of EI-CF. Multi-
objective acquisition functions can be implemented in a similar fashion. For example, Daulton et al.
[19] utilize BOTORCH ’sGenericMCObjective with random scalarizations to implement the ﬁrst
differentiable, parallel, asynchronous, constrained variant of ParEGO [52].
Parallel Noisy Expected Improvement: Letham et al. [55] introduce Noisy EI (NEI), an extension
of EI that is well-suited to highly noisy settings, such as A/B tests, where the best observed value
is unknown. Here, we propose a novel full MC formulation of NEI that extends the original one
from [55] to joint parallel optimization and generic objectives. Letting (ξ,ξ obs)∼ fD((x, xobs)),
our implementation avoids the need to characterize the (uncertain) best observed value explicitly by
averaging improvements on samples from the joint posterior over new and previously evaluated points:
qNEI(x;D) = E
[(
maxg(ξ)− maxg(ξobs)
)
+|D
]
. (4)
Code Example 1 provides an implementation of (4), where X_baseline is an appropriate subset of
the points at which the function was observed. We achieve support for asynchronous evaluation by
concatenating pending points into x (via the @concatenate_pending_points decorator).
5.2 Exploiting Parallelism and Hardware Acceleration
BOTORCH utilizes inference and optimization methods designed to exploit parallelization via batched
computation, and integrates closely with GPyTorch [28]. Many of the underlying computations are
5

class q N o i s y E x p e c t e d I m p r o v e m e n t ( M C A c q F u n c ) :
@ c o n c a t e n a t e _ p e n d i n g _ p o i n t s
@ t _ b a t c h _ m o d e _ t r a n s f o r m ()
def forward ( self , X : Tensor ) -> Tensor :
q = X . shape [ -2]
X_bl = m a t c h _ s h a p e ( self . X_baseline , X )
X_full = torch . cat ([ X , X_bl ] , dim = -2)
p o s t e r i o r = self . model . p o s t e r i o r ( X_full )
samples = self . sampler ( p o s t e r i o r )
obj = self . o b j e c t i v e ( samples )
obj_n = obj [... ,: q ]. max ( dim = -1) . value
obj_p = obj [... , q :]. max ( dim = -1) . value
impr = ( obj_n - obj_p ) . c l a m p _ m i n (0)
return impr . mean ( dim =0)
Code Example 1: Parallel Noisy EI
class q K n o w l e d g e G r a d i e n t ( O n e S h o t A c q F u n c ) :
def forward ( self , X : Tensor ) -> Tensor :
splits = [ X . size ( -2) - self .N , self . N ]
X , X_f = torch . split (X , splits , dim = -2)
if self . X _ p e n d i n g is not None :
X_p = m a t c h _ s h a p e ( self . X_pending , X )
X = torch . cat ([ X , X_p ] , dim = -2)
fmodel = self . model . f a n t a s i z e (
X =X , sampler = self . sampler ,
o b s e r v a t i o n _ n o i s e = True
)
i n n e r _ a c q f = S i m p l e R e g r e t (
fmodel , sampler = self . inner_sampler ,
o b j e c t i v e = self . objective ,
)
with se tt ing s . p r o p a g a t e _ g r a d s ( True ) :
return i n n e r _ a c q f ( X_f ) . mean ( dim =0)
Code Example 2: One-Shot Knowledge Gradient
reduced to matrix multiplications that scale extremely well on GPUs. Test-time performance (e.g., for
optimizing acquisition functions) is particularly efﬁcient when utilizing GPyTorch’s implementation
of approximate predictive covariance matrices involved in sampling from GPs [75].
Figure 6 reports wall times for batch evaluation of qExpectedImprovement at multiple candidate
sets{xi}b
i=1 for different MC samples sizes N, on both CPU and GPU for a GPyTorch GP. We
observe signiﬁcant speedups from running on the GPU, with scaling essentially linear in the batch
sizeb, except for very largeb andN. Figure 7 shows between 10–40X speedups when using fast
predictive covariance estimates over standard posterior inference in the same setting. Together, batch
evaluation and fast predictive distributions enable efﬁcient computation of the acquisition function
for a very large number (tens of thousands) of points in parallel. This scalability unlocks novel
optimization and initialization methods (for additional details see Appendix B).
6 A Novel One-Shot Formulation of KG using B OTORCH
Together, our SAA approach and BOTORCH ’s abstractions enable a novel formulation of a class
of look-ahead acquisition functions. For the purpose of this paper we focus on KG [ 26], but our
methods extend to other look-ahead acquisition functions such as two-step EI [101]. Our method can
be implemented in a straightforward way without using specialized optimization techniques.
KG quantiﬁes the expected increase in the maximum off from obtaining the additional (random)
data{x,yD(x)}. KG often shows improved BO performance relative to simpler, myopic acquisition
functions such as EI [ 84], but in its traditional form it is computationally expensive and hard to
implement, two caveats that we alleviate in this work. WritingDx :=D∪{ x, yD(x)}, we introduce
a generalized variant of parallel KG (qKG) [99]:
αKG(x;D) = E
[
max
x′∈X
E
[
g(f(x′))|D x
]
|D
]
−µ∗
D, (5)
withµ∗
D := maxx∈X E[g(f(x))|D ]. (5) quantiﬁes the expected increase in the maximum posterior
mean ofg◦f after gathering samples at x. For simplicity, we only consider standard BO here, but
extensions for multi-ﬁdelity optimization [76, 104] are also available in BOTORCH .
Maximizing KG presents a nested optimization problem. The standard approach is to optimize the
inner and outer problems separately, in an iterative fashion. The outer optimization is handled using
stochastic gradient ascent, with each gradient observation potentially being an average over multiple
samples [99, 103]. For each sampleyi
D(x)∼yD(x), the inner problem maxxi∈X E
[
f(xi)|D i
x
]
is
solved numerically, either via another stochastic gradient ascent [103] or multi-start L-BFGS-B [25].
An unbiased stochastic gradient of KG can then be computed by leveraging the envelope theorem.
Alternatively, the inner problem can be discretized [99]. The associated computational expense of
this nested optimization can be quite large; our main insight is that it may also be unnecessary.
We treat optimizing αKG(x,D) in (5) as an entirely deterministic optimization problem using
SAA. Using the reparameterization trick, we express yD(x) = hy
D(x,ϵ ) for some deterministic
functionhD.3 We drawN ﬁxed base samples{ϵi}N
i=1 for the outer expectation. The resulting MC
3For a GP,hy
D(x,ϵ )=µD(x)+Lσ
D(x)ϵ, withLσ
D(x) a root decomposition of Σσ
D(x):=ΣD(x, x)+Σv(x).
6

approximation of KG is
ˆαKG,N(x;D) = 1
N
N∑
i=1
max
xi∈X
E
[
g(f(xi))|Di
x
]
−µ∗. (6)
Theorem 2. Suppose conditions (i) and (ii) of Theorem 1 hold, and that (iii)g(·) is afﬁne. If the base
samples{ϵi}i≥1 are drawn i.i.d fromN (0, 1), then (1) ˆα∗
KG,N→α∗
KG a.s., (2) dist(ˆx∗
KG,N,X∗
KG)→
0 a.s., and (3)∀δ >0,∃K <∞,α> 1 s.t. P
(
dist(ˆx∗
KG,N,X∗
KG)>δ
)
≤Ke−αN for allN≥ 1.
Theorem 2 also applies when using RQMC (Appendix D.3), in which case we again observe improved
empirical convergence rates. In Appendix D.4, we prove that if ftrue is drawn from the same GP
prior as f andg(f)≡ f, then the KG policy (i.e., when used to select sequential measurements
in a dynamic setting) is asymptotically optimal [26, 24, 77, 7], meaning that as the number of
measurements tends to inﬁnity, an optimal pointx∗∈X ∗
f := arg maxx∈Xf(x) is identiﬁed.
Conditional on the ﬁxed base samples, (6) does not exhibit the kind of nested structure as
the conventional formulation (that requires solving an optimization problem to get a noisy gra-
dient estimate). Moving the maximization outside of the sample average yields theequivalent problem
max
x∈X
ˆαKG,N(x,D)≡ max
x, x′
1
N
N∑
i=1
E
[
g(f(xi))|Di
x
]
, (7)
where x′ :={xi}N
i=1∈ XN represent “next stage” solutions, or “fantasy points.” If g is afﬁne,
the expectation in (7) admits an analytical expression. If not, we use another MC approximation
of the form (2) with NI ﬁxed inner based samples EI.4 The key difference from the envelope
theorem approach to optimizing KG [103] is that we do not solve the inner optimization problem
to completion for every fantasy point for every gradient step w.r.t. x. Instead, we solve (7) jointly
over x and the fantasy points x′. The resulting optimization problem is of higher dimension, namely
(q +N)d instead ofqd, but unlike the envelope theorem formulation it can be solved as a single
optimization problem, using methods for deterministic optimization. Consequently, we dub the KG
variant utilizing this optimization strategy the “One-Shot Knowledge Gradient” (OKG ). The ability
to auto-differentiate the involved quantities (including the samplesyi
D(x) andξi
Dx(x) through the
posterior updates) w.r.t. x and x′ allows BOTORCH to solve this problem effectively.
Code Example 2 shows a simpliﬁed OKG implementation (full implementations of all examples
are provided in Appendix H.3). The ﬁxed base samples are deﬁned as part of the sampler mod-
ule. SimpleRegret computes E
[
g(f(xi))|Di
x
]
from (7) for each i in batch mode. By expecting
forward’s inputX to be the concatenation of x and x′, OKG can be optimized using the same APIs
as all other acquisition functions (note that in doing so, we differentiate through fantasize).
7 Experiments
In this section, we compare (i) the empirical performance of standard algorithms implemented in
BOTORCH with those from other popular BO libraries, and (ii) our novel acquisition function, OKG,
against other acquisition functions, both within BOTORCH and in other packages. We isolate three
key frameworks—GPyOpt, Cornell MOE ( MOE EI, MOE KG), and Dragonﬂy—because they are the
most popular libraries with ongoing support. 5 and are most closely related to BOTORCH in terms
of state-of-the-art acquisition functions. GPyOpt uses an extension of EI with a local penalization
heuristic (henceforth GPyOpt LP-EI) for parallel optimization [34]. Dragonﬂy does not provide a
modular API, so we consider its default ensemble heuristic (henceforth Dragonﬂy GP Bandit) [47].
Our results provide three main takeaways. First, we ﬁnd that BOTORCH ’s algorithms tend to achieve
greater sample efﬁciency compared to those of other packages (all packages use their default models
and settings). Second, we ﬁnd that OKG often outperforms all other acquisition functions. Finally,
OKG is more computationally scalable than MOE KG (the gold-standard implementation of KG),
showing signiﬁcant reductions in wall time (up to 6X, see Appendix C.2) while simultaneously
achieving improved optimization performance (Figure 4).
4Convergence results can be established in the same way, and will require thatmin{N,NI}→∞
5We were unable to install GPFlowOpt due to its incompatibility with current versions of GPFlow/TensorFlow.
7

25 50 75 100 125 150 175 200
number/uni00A0of/uni00A0observations/uni00A0(including/uni00A0initial/uni00A0points)
10−1
100
regret/uni00A0of/uni00A0suggested/uni00A0point/uni00A0(log/uni00A0scale)
RND
BoTorch/uni00A0EI
BoTorch/uni00A0NEI
BoTorch/uni00A0OKG
MOE/uni00A0KG
MOE/uni00A0EI
GPyOpt/uni00A0LP/uni00ADEI
Dragonfly/uni00A0GP/uni00A0Bandit
Figure 4: Hartmann (d = 6), noisy, best suggested
10 20 30 40 50 60 70
number/uni00A0of/uni00A0observations/uni00A0(including/uni00A0initial/uni00A0points)
100
120
140
160
180best/uni00A0observed/uni00A0function/uni00A0value
RND
BoTorch/uni00A0EI
BoTorch/uni00A0NEI
BoTorch/uni00A0OKG
MOE/uni00A0KG
MOE/uni00A0EI
GPyOpt/uni00A0LP/uni00ADEI
Dragonfly/uni00A0GP/uni00A0Bandit Figure 5: DQN tuning benchmark (Cartpole)
Synthetic Test Functions: We consider BO for parallel optimization of q = 4 design points, on
four noisy synthetic functions used in Wang et al. [94]: Branin, Rosenbrock, Ackley, and Hartmann.
Figure 4 reports means and 95% conﬁdence intervals over 100 trials for Hartmann; results for the
other functions are qualitatively similar and are provided in Appendix C.1, together with details on
the evaluation. Results for constrained BO using a differentiable relaxation of the feasibility indicator
on the sample level are provided in Appendix C.3.
Hyperparameter Optimization: We illustrate the performance of BOTORCH on real-world applica-
tions, represented by three hyperparameter optimization (HPO) experiments: 1.) Tuning 5 parameters
of a deep Q-network (DQN) learning algorithm [61, 62] on the Cartpole task from OpenAI gym [11]
and the default DQN agent implemented in Horizon [ 29], Figure 5; 2.) Tuning 6 parameters of a
neural network surrogate model for the UCI Adult data set [ 20] introduced by Falkner et al. [22],
available as part of HPOlib2 [21], Figure 17 in Appendix C.4; 3.) Tuning 3 parameters of the recently
proposed Stochastic Weight Averaging(SW A) procedure of Izmailov et al.[40] on the VGG-16 [87]
architecture for CIFAR-10, which achieves superior accuracy compared to previously reported results.
A more detailed description of these experiments is given in Appendix C.4.
8 Discussion and Outlook
We presented a novel strategy for effectively optimizing MC acquisition functions using SAA,
and established strong theoretical convergence guarantees (in fact, our RQMC convergence results
are novel more generally, and of independent interest). Our proposed OKG , an extension of this
approach to “one-shot” optimization of look-ahead acquisition functions, constitutes a signiﬁcant
development of KG, improving scalability and allowing for generic composite objectives and outcome
constraints. This approach can naturally be extended to multi-step and other look-ahead approaches.
We make these methodological and theoretical contributions available in BOTORCH , a modern
programming framework for BO that features a modular design and ﬂexible API, our distinct SAA
approach, and algorithms speciﬁcally designed to exploit modern computing paradigms such as
parallelization and auto-differentiation. BOTORCH is particularly valuable in helping researcher to
rapidly assemble novel BO techniques. Speciﬁcally, the basic MC acquisition function abstraction
provides generic support for batch optimization, asynchronous evaluation, RQMC integration, and
composite objectives (including outcome constraints).
Our empirical results show that besides increased ﬂexibility, our advancements in both methodol-
ogy and computational efﬁciency translate into signiﬁcantly faster and more accurate closed-loop
optimization performance on a range of standard problems. While other settings such as high-
dimensional [ 45, 95], multi-ﬁdelity [76, 104], or multi-objective [52, 73] BO are outside the scope of
this paper, these approaches can readily be realized in BOTORCH , and implementations are available.
One can also naturally generalize BO procedures to incorporate neural architectures in BOTORCH
using standard PyTorch models. In particular, deep kernel architectures [ 96], deep Gaussian pro-
cesses [18, 82], and variational auto-encoders [33, 63] can easily be incorporated into BOTORCH ’s
primitives, and can be used for more expressive kernels in high-dimensions.
In summary, BOTORCH provides the research community with a robust and extensible basis
for implementing new ideas and algorithms in a modern computational paradigm, theoretically
backed by our novel SAA convergence results. BOTORCH is open source and available at
https://github.com/pytorch/botorch.
8

References
[1] Martín Abadi, Paul Barham, Jianmin Chen, Zhifeng Chen, Andy Davis, Jeffrey Dean, Matthieu Devin,
Sanjay Ghemawat, Geoffrey Irving, Michael Isard, et al. Tensorﬂow: A system for large-scale machine
learning. In OSDI, volume 16, pages 265–283, 2016.
[2] Robert J Adler. An introduction to continuity, extrema, and related topics for general gaussian processes.
IMS, 1990.
[3] Robert J. Adler. The Geometry of Random Fields. Society for Industrial and Applied Mathematics, 2010.
[4] Deepak Agarwal, Kinjal Basu, Souvik Ghosh, Ying Xuan, Yang Yang, and Liang Zhang. Online parameter
selection for web-based ranking problems. In Proceedings of the 24th ACM SIGKDD International
Conference on Knowledge Discovery & Data Mining, KDD ’18, pages 23–32, New York, NY , USA, 2018.
ACM.
[5] Rika Antonova, Akshara Rai, and Christopher G. Atkeson. Deep kernels for optimizing locomotion
controllers. In Proceedings of the 1st Conference on Robot Learning, CoRL, 2017.
[6] R. Astudillo and P. Frazier. Bayesian optimization of composite functions. Forthcoming, in Proceedings
of the 35th International Conference on Machine Learning, 2019.
[7] Julien Bect, François Bachoc, and David Ginsbourger. A supermartingale approach to gaussian process
based sequential design of experiments. Bernoulli, 25(4A):2883–2919, 11 2019.
[8] Eli Bingham, Jonathan P. Chen, Martin Jankowiak, Fritz Obermeyer, Neeraj Pradhan, Theofanis Karalet-
sos, Rohit Singh, Paul Szerlip, Paul Horsfall, and Noah D. Goodman. Pyro: Deep Universal Probabilistic
Programming. Journal of Machine Learning Research, 2018.
[9] Nikolay Bliznyuk, David Ruppert, Christine Shoemaker, Rommel Regis, Stefan Wild, and Pradeep
Mugunthan. Bayesian calibration and uncertainty analysis for computationally expensive models using
optimization and radial basis function approximation. Journal of Computational and Graphical Statistics,
17(2):270–294, 2008.
[10] Stéphane Boucheron, Gábor Lugosi, and Pascal Massart. Concentration inequalities: A nonasymptotic
theory of independence. Oxford university press, 2013.
[11] Greg Brockman, Vicki Cheung, Ludwig Pettersson, Jonas Schneider, John Schulman, Jie Tang, and
Wojciech Zaremba. Openai gym. arXiv preprint arXiv:1606.01540, 2016.
[12] Alexander Buchholz, Florian Wenzel, and Stephan Mandt. Quasi-Monte Carlo variational inference.
In Proceedings of the 35th International Conference on Machine Learning , Proceedings of Machine
Learning Research, 2018.
[13] Russel E Caﬂisch. Monte carlo and quasi-monte carlo methods. Acta numerica, 7:1–49, 1998.
[14] Roberto Calandra, André Seyfarth, Jan Peters, and Marc Peter Deisenroth. Bayesian optimization for
learning gaits under uncertainty. Annals of Mathematics and Artiﬁcial Intelligence, 2016.
[15] Tianqi Chen, Mu Li, Yutian Li, Min Lin, Naiyan Wang, Minjie Wang, Tianjun Xiao, Bing Xu, Chiyuan
Zhang, and Zheng Zhang. MXNet: A ﬂexible and efﬁcient machine learning library for heterogeneous
distributed systems. arXiv preprint arXiv:1512.01274, 2015.
[16] Xi Chen and Qiang Zhou. Sequential experimental designs for stochastic kriging. In Proceedings of the
2014 Winter Simulation Conference, WSC ’14, pages 3821–3832, Piscataway, NJ, USA, 2014. IEEE
Press.
[17] Kurt Cutajar, Mark Pullin, Andreas Damianou, Neil Lawrence, and Javier González. Deep gaussian
processes for multi-ﬁdelity modeling. arXiv preprint arXiv:1903.07320, 2019.
[18] Andreas Damianou and Neil Lawrence. Deep gaussian processes. In Artiﬁcial Intelligence and Statistics,
pages 207–215, 2013.
[19] Samuel Daulton, Maximilian Balandat, and Eytan Bakshy. Differentiable Expected Hypervolume
Improvement for Parallel Multi-Objective Bayesian Optimization. ArXiv e-prints, 2020.
[20] Dheeru Dua and Casey Graff. UCI machine learning repository, 2017. URL http://archive.ics.uci.edu/ml.
[21] Katharina Eggensperger, Matthias Feurer, Aaron Klein, and Stefan Falkner. Hpolib2 (development
branch), 2019. URL https://github.com/automl/HPOlib2.
9

[22] Stefan Falkner, Aaron Klein, and Frank Hutter. BOHB: robust and efﬁcient hyperparameter optimization
at scale. CoRR, abs/1807.01774, 2018.
[23] Matthias Feurer, Aaron Klein, Katharina Eggensperger, Jost Springenberg, Manuel Blum, and Frank
Hutter. Efﬁcient and robust automated machine learning. In C. Cortes, N. D. Lawrence, D. D. Lee,
M. Sugiyama, and R. Garnett, editors, Advances in Neural Information Processing Systems 28, pages
2962–2970. Curran Associates, Inc., 2015.
[24] Peter Frazier, Warren Powell, and Savas Dayanik. The knowledge-gradient policy for correlated normal
beliefs. INFORMS journal on Computing, 21(4):599–613, 2009.
[25] Peter I Frazier. A tutorial on bayesian optimization. arXiv preprint arXiv:1807.02811, 2018.
[26] Peter I Frazier, Warren B Powell, and Savas Dayanik. A knowledge-gradient policy for sequential
information collection. SIAM Journal on Control and Optimization, 47(5):2410–2439, 2008.
[27] Jacob Gardner, Matt Kusner, Zhixiang, Kilian Weinberger, and John Cunningham. Bayesian optimization
with inequality constraints. In Proceedings of the 31st International Conference on Machine Learning,
volume 32 of Proceedings of Machine Learning Research, pages 937–945, Beijing, China, 22–24 Jun
2014. PMLR.
[28] Jacob Gardner, Geoff Pleiss, Kilian Q Weinberger, David Bindel, and Andrew G Wilson. Gpytorch:
Blackbox matrix-matrix gaussian process inference with gpu acceleration. In Advances in Neural
Information Processing Systems, pages 7576–7586, 2018.
[29] Jason Gauci, Edoardo Conti, Yitao Liang, Kittipat Virochsiri, Yuchen He, Zachary Kaden, Vivek
Narayanan, and Xiaohui Ye. Horizon: Facebook’s open source applied reinforcement learning platform.
arXiv preprint arXiv:1811.00260, 2018.
[30] Michael A. Gelbart, Jasper Snoek, and Ryan P. Adams. Bayesian optimization with unknown constraints.
In Proceedings of the 30th Conference on Uncertainty in Artiﬁcial Intelligence, UAI, 2014.
[31] David Ginsbourger and Rodolphe Le Riche. Towards gaussian process-based optimization with ﬁnite
time horizon. In Alessandra Giovagnoli, Anthony C. Atkinson, Bernard Torsney, and Caterina May,
editors, mODa 9 – Advances in Model-Oriented Design and Analysis, pages 89–96. Physica-Verlag HD,
2010.
[32] David Ginsbourger, Janis Janusevskis, and Rodolphe Le Riche. Dealing with Asynchronicity in Parallel
Gaussian Process Based Global Optimization. Technical report, 2011. URL https://hal.archives-ouvertes.
fr/hal-00507632.
[33] Rafael Gómez-Bombarelli, Jennifer N. Wei, David Duvenaud, JoséMiguel Hernández-Lobato, Benjamín
Sánchez-Lengeling, Dennis Sheberla, Jorge Aguilera-Iparraguirre, Timothy D. Hirzel, Ryan P. Adams,
and Alán Aspuru-Guzik. Automatic chemical design using a data-driven continuous representation of
molecules. ACS Central Science, 4(2):268–276, 02 2018.
[34] Javier González, Zhenwen Dai, Philipp Hennig, and Neil D. Lawrence. Batch bayesian optimization via
local penalization. In Proceedings of the 19th International Conference on Artiﬁcial Intelligence and
Statistics, AISTATS, pages 648–657, 2016.
[35] GPy. GPy: A gaussian process framework in python. http://github.com/ShefﬁeldML/GPy, since 2012.
[36] Ryan-Rhys Grifﬁths and José Miguel Hernández-Lobato. Constrained bayesian optimization for automatic
chemical design. arXiv preprint arXiv:1709.05501, 2017.
[37] Nikolaus Hansen and Andreas Ostermeier. Completely derandomized self-adaptation in evolution
strategies. Evol. Comput., 9(2):159–195, June 2001.
[38] José Miguel Hernández-Lobato, Michael A. Gelbart, Matthew W. Hoffman, Ryan P. Adams, and Zoubin
Ghahramani. Predictive entropy search for bayesian optimization with unknown constraints. In Proceed-
ings of the 32nd International Conference on Machine Learning, ICML, 2015.
[39] Tito Homem-de-Mello. On rates of convergence for stochastic optimization problems under non-
independent and identically distributed sampling. SIAM Journal on Optimization , 19(2):524–551,
2008.
[40] Pavel Izmailov, Dmitrii Podoprikhin, Timur Garipov, Dmitry Vetrov, and Andrew Gordon Wilson.
Averaging weights leads to wider optima and better generalization. arXiv preprint arXiv:1803.05407,
2018.
10

[41] Pavel Izmailov, Wesley Maddox, Timur Garipov, Polina Kirichenko, Dmitry Vetrov, and Andrew Gordon
Wilson. Subspace inference for Bayesian deep learning. In Uncertainty in Artiﬁcial Intelligence, 2019.
[42] Yangqing Jia, Evan Shelhamer, Jeff Donahue, Sergey Karayev, Jonathan Long, Ross Girshick, Sergio
Guadarrama, and Trevor Darrell. Caffe: Convolutional architecture for fast feature embedding. arXiv
preprint arXiv:1408.5093, 2014.
[43] D. R. Jones, C. D. Perttunen, and B. E. Stuckman. Lipschitzian optimization without the lipschitz constant.
Journal of Optimization Theory and Applications, 79(1):157–181, Oct 1993.
[44] Donald R. Jones, Matthias Schonlau, and William J. Welch. Efﬁcient global optimization of expensive
black-box functions. Journal of Global Optimization, 13:455–492, 1998.
[45] Kirthevasan Kandasamy, Jeff Schneider, and Barnabás Póczos. High dimensional bayesian optimisation
and bandits via additive models. In Proceedings of the 32nd International Conference on Machine
Learning, ICML, 2015.
[46] Kirthevasan Kandasamy, Gautam Dasarathy, Junier Oliva, Jeff Schneider, and Barnab’as P’oczos. Gaus-
sian process bandit optimisation with multi-ﬁdelity evaluations. In Advances in Neural Information
Processing Systems, NIPS, 2016.
[47] Kirthevasan Kandasamy, Karun Raju Vysyaraju, Willie Neiswanger, Biswajit Paria, Christopher R.
Collins, Jeff Schneider, Barnabas Póczos, and Eric P. Xing. Tuning Hyperparameters without Grad Stu-
dents: Scalable and Robust Bayesian Optimisation with Dragonﬂy. arXiv e-prints, art. arXiv:1903.06694,
Mar 2019.
[48] Diederik P Kingma and Max Welling. Auto-Encoding Variational Bayes. arXiv e-prints , page
arXiv:1312.6114, Dec 2013.
[49] A. Klein, S. Falkner, S. Bartels, P. Hennig, and F. Hutter. Fast bayesian optimization of machine learning
hyperparameters on large datasets. CoRR, 2016.
[50] A. Klein, S. Falkner, N. Mansur, and F. Hutter. Robo: A ﬂexible and robust bayesian optimization
framework in python. In NIPS 2017 Bayesian Optimization Workshop, December 2017.
[51] Anton J Kleywegt, Alexander Shapiro, and Tito Homem-de Mello. The sample average approximation
method for stochastic discrete optimization. SIAM Journal on Optimization, 12(2):479–502, 2002.
[52] J. Knowles. Parego: a hybrid algorithm with on-line landscape approximation for expensive multiobjective
optimization problems. IEEE Transactions on Evolutionary Computation, 10(1):50–66, 2006.
[53] Nicolas Knudde, Joachim van der Herten, Tom Dhaene, and Ivo Couckuyt. GPﬂowOpt: A Bayesian
Optimization Library using TensorFlow. arXiv preprint – arXiv:1711.03845, 2017.
[54] Benjamin Letham and Eytan Bakshy. Bayesian optimization for policy search via online-ofﬂine experi-
mentation. arXiv preprint arXiv:1904.01049, 2019.
[55] Benjamin Letham, Brian Karrer, Guilherme Ottoni, and Eytan Bakshy. Constrained bayesian optimization
with noisy experiments. Bayesian Analysis, 14(2):495–519, 06 2019.
[56] Cheng Li, David Rubín de Celis Leal, Santu Rana, Sunil Gupta, Alessandra Sutti, Stewart Greenhill,
Teo Slezak, Murray Height, and Svetha Venkatesh. Rapid bayesian optimisation for synthesis of short
polymer ﬁber materials. Scientiﬁc reports, 7(1):5683, 2017.
[57] Wesley Maddox, Timur Garipov, Pavel Izmailov, Dmitry Vetrov, and Andrew Gordon Wilson. A simple
baseline for Bayesian uncertainty in deep learning. In Advances in Neural Information Processing
Systems, 2019.
[58] Malaria Atlas Project. Malaria atlas project, 2019. URL https://map.ox.ac.uk/
malaria-burden-data-download.
[59] Alexander G. de G. Matthews, Mark van der Wilk, Tom Nickson, Keisuke. Fujii, Alexis Boukouvalas,
Pablo León-Villagrá, Zoubin Ghahramani, and James Hensman. GPﬂow: A Gaussian process library
using TensorFlow. Journal of Machine Learning Research, 18(40):1–6, apr 2017.
[60] Richard M Meyer. Essential mathematics for applied ﬁelds. Springer Science & Business Media, 2012.
[61] V olodymyr Mnih, Koray Kavukcuoglu, David Silver, Alex Graves, Ioannis Antonoglou, Daan Wierstra,
and Martin Riedmiller. Playing atari with deep reinforcement learning. arXiv preprint arXiv:1312.5602,
2013.
11

[62] V olodymyr Mnih, Koray Kavukcuoglu, David Silver, Andrei A Rusu, Joel Veness, Marc G Bellemare,
Alex Graves, Martin Riedmiller, Andreas K Fidjeland, Georg Ostrovski, et al. Human-level control
through deep reinforcement learning. Nature, 518(7540):529, 2015.
[63] Riccardo Moriconi, K. S. Sesh Kumar, and Marc Peter Deisenroth. High-Dimensional Bayesian Opti-
mization with Manifold Gaussian Processes. arXiv e-prints, page arXiv:1902.10675, Feb 2019.
[64] Iain Murray. Differentiation of the Cholesky decomposition. arXiv e-prints, page arXiv:1602.07527, Feb
2016.
[65] Radford M Neal. Bayesian learning for neural networks, volume 118. Springer Science & Business
Media, 1996.
[66] Willie Neiswanger, Kirthevasan Kandasamy, Barnabas Póczos, Jeff Schneider, and Eric Xing. ProBO:
a Framework for Using Probabilistic Programming in Bayesian Optimization. arXiv e-prints, page
arXiv:1901.11515, January 2019.
[67] Vu Nguyen, Sunil Gupta, Santu Rana, Cheng Li, and Svetha Venkatesh. Predictive variance reduction
search. In NIPS 2017 Workshop on Bayesian Optimization, Dec 2017.
[68] A O’Hagan. On curve ﬁtting and optimal design for regression. J. Royal Stat. Soc. B, 40:1–32, 1978.
[69] Michael A Osborne. Bayesian Gaussian processes for sequential prediction, optimisation and quadrature.
PhD thesis, Oxford University, UK, 2010.
[70] Art B. Owen. Randomly permuted (t,m,s)-nets and (t, s)-sequences. In Harald Niederreiter and Peter
Jau-Shyong Shiue, editors, Monte Carlo and Quasi-Monte Carlo Methods in Scientiﬁc Computing, pages
299–317, New York, NY , 1995. Springer New York.
[71] Art B Owen. Quasi-monte carlo sampling. Monte Carlo Ray Tracing: Siggraph, 1:69–88, 2003.
[72] Art B. Owen and Daniel Rudolf. A strong law of large numbers for scrambled net integration. arXiv
e-prints, page arXiv:2002.07859, February 2020.
[73] B. Paria, K. Kandasamy, and B. Póczos. A Flexible Multi-Objective Bayesian Optimization Approach
using Random Scalarizations. ArXiv e-prints, May 2018.
[74] Adam Paszke, Sam Gross, Soumith Chintala, Gregory Chanan, Edward Yang, Zachary DeVito, Zeming
Lin, Alban Desmaison, Luca Antiga, and Adam Lerer. Automatic differentiation in PyTorch. 2017.
[75] Geoff Pleiss, Jacob R Gardner, Kilian Q Weinberger, and Andrew Gordon Wilson. Constant-time
predictive distributions for gaussian processes. In International Conference on Machine Learning, 2018.
[76] Matthias Poloczek, Jialei Wang, and Peter Frazier. Multi-information source optimization. In Advances
in Neural Information Processing Systems, pages 4288–4298, 2017.
[77] Matthias Poloczek, Jialei Wang, and Peter Frazier. Multi-information source optimization. In Advances
in Neural Information Processing Systems, pages 4288–4298, 2017.
[78] Carl Edward Rasmussen and Christopher KI Williams. Gaussian processes for machine learning. 2006.
The MIT Press, Cambridge, MA, USA, 38:715–719, 2006.
[79] Danilo Jimenez Rezende, Shakir Mohamed, and Daan Wierstra. Stochastic backpropagation and ap-
proximate inference in deep generative models. In Proceedings of the 31st International Conference
on International Conference on Machine Learning - Volume 32 , ICML’14, pages II–1278–II–1286.
JMLR.org, 2014.
[80] Mark Rowland, Krzysztof M Choromanski, François Chalus, Aldo Pacchiano, Tamas Sarlos, Richard E
Turner, and Adrian Weller. Geometrically coupled monte carlo sampling. In Advances in Neural
Information Processing Systems 31, pages 195–206. Curran Associates, Inc., 2018.
[81] Yunus Saatci and Andrew G Wilson. Bayesian GAN. In Advances in neural information processing
systems, pages 3622–3631, 2017.
[82] Hugh Salimbeni and Marc Peter Deisenroth. Doubly stochastic variational inference for deep gaussian
processes. In I. Guyon, U. V . Luxburg, S. Bengio, H. Wallach, R. Fergus, S. Vishwanathan, and R. Garnett,
editors, Advances in Neural Information Processing Systems 30, pages 4588–4599. Curran Associates,
Inc., 2017.
12

[83] Matthias Schonlau, William J. Welch, and Donald R. Jones. Global versus local search in constrained
optimization of computer models. Lecture Notes-Monograph Series, 34:11–25, 1998.
[84] Warren Scott, Peter Frazier, and Warren Powell. The correlated knowledge gradient for simulation
optimization of continuous parameters using Gaussian process regression. SIAM Journal of Optimization,
21:996–1026, 2011.
[85] S. Seo, M. Wallat, T. Graepel, and K. Obermayer. Gaussian process regression: active data selection and
test point rejection. In Proceedings of the IEEE-INNS-ENNS International Joint Conference on Neural
Networks. IJCNN 2000. Neural Computing: New Challenges and Perspectives for the New Millennium,
volume 3, pages 241–246 vol.3, July 2000.
[86] Bobak Shahriari, Kevin Swersky, Ziyu Wang, Ryan P. Adams, and Nando de Freitas. Taking the human
out of the loop: A review of Bayesian optimization. Proceedings of the IEEE, 104:1–28, 2016.
[87] Karen Simonyan and Andrew Zisserman. Very deep convolutional networks for large-scale image
recognition. arXiv preprint arXiv:1409.1556, 2014.
[88] Jasper Snoek, Hugo Larochelle, and Ryan P Adams. Practical bayesian optimization of machine learning
algorithms. In Advances in neural information processing systems, pages 2951–2959, 2012.
[89] Jasper Snoek, Kevin Swersky, Richard Zemel, and Ryan P Adams. Input warping for bayesian opti-
mization of non-stationary functions. In Proceedings of the 31st International Conference on Machine
Learning, ICML’14, 2014.
[90] J. T. Springenberg, A. Klein, S.Falkner, and F. Hutter. Bayesian optimization with robust bayesian neural
networks. In Advances in Neural Information Processing Systems 29, December 2016.
[91] The Emukit authors. Emukit: Emulation and uncertainty quantiﬁcation for decision making. https:
//github.com/amzn/emukit, 2018.
[92] The GPyOpt authors. GPyOpt: A bayesian optimization framework in python. http://github.com/
ShefﬁeldML/GPyOpt, 2016.
[93] Dustin Tran, Matthew D Hoffman, Rif A Saurous, Eugene Brevdo, Kevin Murphy, and David M Blei. Deep
probabilistic programming. Proceedings of the International Conference on Learning Representations
(ICLR), 2017.
[94] Jialei Wang, Scott C Clark, Eric Liu, and Peter I Frazier. Parallel bayesian global optimization of
expensive functions. arXiv preprint arXiv:1602.05149, 2016.
[95] Ziyu Wang, Frank Hutter, Masrour Zoghi, David Matheson, and Nando De Freitas. Bayesian optimization
in a billion dimensions via random embeddings. J. Artif. Int. Res., 55(1):361–387, January 2016.
[96] Andrew Gordon Wilson, Zhiting Hu, Ruslan Salakhutdinov, and Eric P Xing. Deep kernel learning. In
Artiﬁcial Intelligence and Statistics, pages 370–378, 2016.
[97] J. T. Wilson, R. Moriconi, F. Hutter, and Marc Peter Deisenroth. The reparameterization trick for
acquisition functions. ArXiv e-prints, December 2017.
[98] James Wilson, Frank Hutter, and Marc Peter Deisenroth. Maximizing acquisition functions for bayesian
optimization. In Advances in Neural Information Processing Systems 31 , pages 9905–9916. Curran
Associates, Inc., 2018.
[99] Jian Wu and Peter Frazier. The parallel knowledge gradient method for batch bayesian optimization. In
Advances in Neural Information Processing Systems, pages 3126–3134, 2016.
[100] Jian Wu and Peter Frazier. Practical two-step lookahead Bayesian optimization. In Advances in Neural
Information Processing Systems 32, 2019.
[101] Jian Wu and Peter Frazier. Practical two-step lookahead bayesian optimization. In Advances in Neural
Information Processing Systems 32, pages 9810–9820. Curran Associates, Inc., 2019.
[102] Jian Wu and Peter I. Frazier. Discretization-free Knowledge Gradient Methods for Bayesian Optimization.
arXiv e-prints, page arXiv:1707.06541, Jul 2017.
[103] Jian Wu, Matthias Poloczek, Andrew Gordon Wilson, and Peter I Frazier. Bayesian optimization with
gradients. In Advances in Neural Information Processing Systems, pages 5267–5278, 2017.
13

[104] Jian Wu, Saul Toscano-Palmerin, Peter I. Frazier, and Andrew Gordon Wilson. Practical multi-ﬁdelity
bayesian optimization for hyperparameter tuning. CoRR, abs/1903.04703, 2019.
[105] Yichi Zhang, Daniel W Apley, and Wei Chen. Bayesian optimization for materials design with mixed
quantitative and qualitative variables. Scientiﬁc Reports, 10(1):1–13, 2020.
14

Appendix to:
BOTORCH : Bayesian Optimization in PyTorch
A Brief Overview of Other Software Packages for BO
One of the earliest commonly-used packages is Spearmint [88], which implements a variety of
modeling techniques such as MCMC hyperparameter sampling and input warping [89]. Spearmint
also supports parallel optimization via fantasies, and constrained optimization with the expected
improvement and predictive entropy search acquisition functions [30, 38]. Spearmint was among the
ﬁrst libraries to make BO easily accessible to the end user.
GPyOpt [92] builds on the popular GP regression framework GPy [35]. It supports a similar set of
features as Spearmint, along with a local penalization-based approach for parallel optimization [34].
It also provides the ability to customize different components through an alternative, more modular
API.
Cornell-MOE [99] implements the Knowledge Gradient (KG) acquisition function, which allows
for parallel optimization, and includes recent advances such as large-scale models incorporating
gradient evaluations [103] and multi-ﬁdelity optimization [ 104]. Its core is implemented in C++,
which provides performance beneﬁts but renders it hard to modify and extend.
RoBO [50] implements a collection of models and acquisition functions, including Bayesian neural
nets [90] and multi-ﬁdelity optimization [49].
Emukit [91] is a Bayesian optimization and active learning toolkit with a collection of acquisition
functions, including for parallel and multi-ﬁdelity optimization. It does not provide speciﬁc abstrac-
tions for implementing new algorithms, but rather speciﬁes a model API that allows it to be used with
the other toolkit components.
The recent Dragonﬂy [47] library supports parallel optimization, multi-ﬁdelity optimization [ 46],
and high-dimensional optimization with additive kernels [45]. It takes an ensemble approach and
aims to work out-of-the-box across a wide range of problems, a design choice that makes it relatively
hard to extend.
B Parallelism and Hardware Acceleration
B.1 Batch Evaluation
Batch evaluation, an important element of modern computing, enables automatic dispatch of indepen-
dent operations across multiple computational resources (e.g. CPU and GPU cores) for parallelization
and memory sharing. All BOTORCH components support batch evaluation, which makes it easy
to write concise and highly efﬁcient code in a platform-agnostic fashion. Batch evaluation enables
fast queries of acquisition functions at a large number of candidate sets in parallel, facilitating novel
initialization heuristics and optimization techniques.
Speciﬁcally, instead of sequentially evaluating an acquisition function at a number of candidate
sets x1,..., xb, where xk∈ Rq×d for eachk, BOTORCH evaluates a batched tensor x∈ Rb×q×d.
Computation is automatically distributed so that, depending on the hardware used, speedups can be
close to linear in the batch sizeb. Batch evaluation is also heavily used in computing MC acquisition
functions, with the effect that signiﬁcantly increasing the number of MC samples often has little
impact on wall time. In Figure 6 we observe signiﬁcant speedups from running on the GPU, with
scaling essentially linear in the batch size, except for very large b andN. The ﬁxed cost due to
communication overhead renders CPU evaluation faster for small batch and sample sizes.
15

B.2 Fast Posterior Evaluation
While much of the literature on scalable GPs focuses on space-time complexity for training, it is
fast test-time (predictive) distributions that are crucial for applications where the same model is
evaluated many times, such as when optimizing acquisition function in BO. GPyTorch makes use of
structure-exploiting algebra and local interpolation forO(1) computations in querying the predictive
distribution, andO(T ) for a posterior sample at T points, compared to the standard O(n2) and
O(T 3n3) computations [75].
Figure 7 shows 10-40X speedups when using fast predictive covariance estimates over performing
standard posterior inference in the setting from Section 5.2. The reported relative speedups grow
slower on the GPU, whose cores do not saturate as quickly as on the CPU when doing standard
posterior inference.
1024256 512164 64
batch/uni00A0size/uni00A0(number/uni00A0of/uni00A0evaluations)
2.0
3.9
7.8
15.6
31.2
62.5
125.0
250.0
500.0wall/uni00A0time/uni00A0[ms]
N=128,/uni00A0CPU
N=1024,/uni00A0CPU
N=128,/uni00A0GPU
N=1024,/uni00A0GPU
Figure 6: Wall times for batched evaluation of qEI
1024256 512164 64
batch/uni00A0size/uni00A0(number/uni00A0of/uni00A0evaluations)
0
5
10
15
20
25
30
35
40relative/uni00A0speedup
N=128,/uni00A0CPU
N=512,/uni00A0CPU
N=1024,/uni00A0CPU
N=128,/uni00A0GPU
N=512,/uni00A0GPU
N=1024,/uni00A0GPU Figure 7: Fast predictive distributions speedups
C Additional Empirical Results
This section describes a number of empirical results that were omitted from the main paper due to
space constraints.
C.1 Synthetic Functions
Algorithms start from the same set of 2d + 2 QMC sampled initial points for each trial, with d
the dimension of the design space. We evaluate based on the true noiseless function value at the
“suggested point” (i.e., the point to be chosen if BO were to end at this batch ). OKG , MOE KG,
and NEI use “out-of-sample” suggestions (χn from Section 6, while the others use “in-sample”
suggestions [25].
All functions are evaluated with noise generated from aN (0,. 25) distribution. Figures 9-11 give the
results for all synthetic functions from Section 7. The results show that BOTORCH ’s NEI andOKG
acquisition functions provide highly competitive performance in all cases.
25 50 75 100 125 150 175 200
number/uni00A0of/uni00A0observations/uni00A0(including/uni00A0initial/uni00A0points)
100
6 × 10−1
2 × 100
regret/uni00A0of/uni00A0suggested/uni00A0point/uni00A0(log/uni00A0scale)
LBFGS/uni00ADB,/uni00A01024/uni00A0fixed/uni00A0samples
ADAM,/uni00A0LR=0.01,/uni00A0128/uni00A0samples/iteration
SGD,/uni00A0LR=0.01,/uni00A0128/uni00A0samples/iteration
ADAM,/uni00A0LR=0.03,/uni00A0128/uni00A0samples/iteration
SGD,/uni00A0LR=0.03,/uni00A0128/uni00A0samples/iteration
ADAM,/uni00A0LR=0.05,/uni00A0128/uni00A0samples/iteration
SGD,/uni00A0LR=0.05,/uni00A0128/uni00A0samples/iteration
Figure 8: Stochastic/deterministic opt. of EI on Hart-
mann6
0 20 40 60 80 100 120 140 160
number/uni00A0of/uni00A0observations/uni00A0(including/uni00A0initial/uni00A0points)
10−2
10−1
100
101
regret/uni00A0of/uni00A0suggested/uni00A0point/uni00A0(log/uni00A0scale)
RND
BoTorch/uni00A0EI
BoTorch/uni00A0NEI
BoTorch/uni00A0OKG
MOE/uni00A0KG
MOE/uni00A0EI
GPyOpt/uni00A0LP/uni00ADEI
Dragonfly/uni00A0GP/uni00A0Bandit Figure 9: Branin (d = 2)
16

0 50 100 150 200 250
number/uni00A0of/uni00A0observations/uni00A0(including/uni00A0initial/uni00A0points)
10−1
100
101
102
103
regret/uni00A0of/uni00A0suggested/uni00A0point/uni00A0(log/uni00A0scale)
RND
BoTorch/uni00A0EI
BoTorch/uni00A0NEI
BoTorch/uni00A0OKG
MOE/uni00A0KG
MOE/uni00A0EI
GPyOpt/uni00A0LP/uni00ADEI
Dragonfly/uni00A0GP/uni00A0Bandit
Figure 10: Rosenbrock (d = 3)
25 50 75 100 125 150 175 200
number/uni00A0of/uni00A0observations/uni00A0(including/uni00A0initial/uni00A0points)
10−1
100
regret/uni00A0of/uni00A0suggested/uni00A0point/uni00A0(log/uni00A0scale)
RND
BoTorch/uni00A0EI
BoTorch/uni00A0NEI
BoTorch/uni00A0OKG
MOE/uni00A0KG
MOE/uni00A0EI
GPyOpt/uni00A0LP/uni00ADEI
Dragonfly/uni00A0GP/uni00A0Bandit Figure 11: Ackley (d = 5)
0 50 100 150 200 250 300 350 400
number/uni00A0of/uni00A0observations/uni00A0(including/uni00A0initial/uni00A0points)
0
100
200
300
400
500
600wall/uni00A0time/uni00A0(s)
Cholesky,/uni00A0CPU
Linear/uni00A0CG,/uni00A0CPU
Cholesky,/uni00A0GPU
Linear/uni00A0CG,/uni00A0GPU
MOE,/uni00A0CPU
Figure 12: KG wall times
25 50 75 100 125 150 175 200
number/uni00A0of/uni00A0observations/uni00A0(including/uni00A0initial/uni00A0points)
10−1
100
regret/uni00A0of/uni00A0suggested/uni00A0point/uni00A0(log/uni00A0scale)
RND
BoTorch/uni00A0EI
BoTorch/uni00A0NEI
BoTorch/uni00A0OKG
MOE/uni00A0KG
MOE/uni00A0EI
GPyOpt/uni00A0LP/uni00ADEI
Dragonfly/uni00A0GP/uni00A0Bandit Figure 13: Hartmann (d = 6), noisy, best suggested
C.2 One-Shot KG Computational Scaling
Figure 12 shows the wall time for generating a set ofq = 8 candidates as a function of the number
of total data pointsn for both standard (Cholesky-based) as well as scalable (Linear CG) posterior
inference methods, on both CPU and GPU. While the GPU variants have a signiﬁcant overhead
for small models, they are signiﬁcantly faster for larger models. Notably, our SAA based OKG
is signiﬁcantly faster than MOE KG, while at the same time achieving much better optimization
performance (Figure 13).
C.3 Constrained Bayesian Optimization
We present results for constrained BO on a synthetic function. We consider a multi-output function
f = (f1,f 2) and the optimization problem:
max
x∈X
f1(x) s.t. f2(x)≤ 0. (8)
Both f1 and f2 are observed with N (0, 0.52) noise and we model the two components using
independent GP models. A constraint-weighted composite objective is used in each of the BOTORCH
acquisition functions EI, NEI, and OKG.
Results for the case of a Hartmann6 objective and two types of constraints are given in Figures 14-15
(we only show results for BOTORCH ’s algorithms, since the other packages do not natively support
optimization subject to unknown constraints).
The regret values are computed using a feasibility-weighted objective, where “infeasible” is assigned
an objective value of zero. For random search and EI, the suggested point is taken to be the
best feasible noisily observed point, and for NEI and OKG, we use out-of-sample suggestions by
optimizing the feasibility-weighted version of the posterior mean. The results displayed in Figure
15 are for the constrained Hartmann6 benchmark from [ 55]. Note, however, that the results here
are not directly comparable to the ﬁgures in [55] because (1) we use feasibility-weighted objectives
to compute regret and (2) they follow a different convention for suggested points. We emphasize
that our contribution of outcome constraints for the case of KG has not been shown before in the
literature.
17

25 50 75 100 125 150 175 200
number/uni00A0of/uni00A0observations/uni00A0(including/uni00A0initial/uni00A0points)
10−1
100
regret/uni00A0of/uni00A0suggested/uni00A0point/uni00A0(log/uni00A0scale)
RND
BoTorch/uni00A0EI
BoTorch/uni00A0NEI
BoTorch/uni00A0OKG
Figure 14: Constrained Hartmann6,f2(x) =‖x‖1− 3
25 50 75 100 125 150 175 200
number/uni00A0of/uni00A0observations/uni00A0(including/uni00A0initial/uni00A0points)
100
6 × 10−1
2 × 100
3 × 100
regret/uni00A0of/uni00A0suggested/uni00A0point/uni00A0(log/uni00A0scale)
RND
BoTorch/uni00A0EI
BoTorch/uni00A0NEI
BoTorch/uni00A0OKG Figure 15: Constrained Hartmann6,f1(x) =‖x‖2− 1
10 20 30 40 50 60 70
number/uni00A0of/uni00A0observations/uni00A0(including/uni00A0initial/uni00A0points)
100
120
140
160
180best/uni00A0observed/uni00A0function/uni00A0value
RND
BoTorch/uni00A0EI
BoTorch/uni00A0NEI
BoTorch/uni00A0OKG
MOE/uni00A0KG
MOE/uni00A0EI
GPyOpt/uni00A0LP/uni00ADEI
Dragonfly/uni00A0GP/uni00A0Bandit
Figure 16: DQN tuning benchmark (Cartpole)
10 20 30 40 50 60 70 80
number/uni00A0of/uni00A0observations/uni00A0(including/uni00A0initial/uni00A0points)
84.95
85.00
85.05
85.10
85.15
85.20
85.25best/uni00A0observed/uni00A0accuracy
RND
BoTorch/uni00A0EI
BoTorch/uni00A0NEI
BoTorch/uni00A0OKG
MOE/uni00A0KG
MOE/uni00A0EI
GPyOpt/uni00A0EI
Dragonfly/uni00A0GP/uni00A0Bandit Figure 17: NN surrogate model, best observed accuracy
C.4 Hyperparameter Optimization Details
This section gives further detail on the experimental settings used in each of the hyperparameter
optimization problems. As HPO typically involves long and resource intensive training jobs, it is
standard to select the conﬁguration with the best observed performance, rather than to evaluate a
“suggested” conﬁguration (we cannot perform noiseless function evaluations).
DQN and Cartpole: We consider the case of tuning a deep Q-network (DQN) learning algorithm
[61, 62] on the Cartpole task from OpenAI gym [11] and the default DQN agent implemented in
Horizon [29]. Figure 16 shows the results of tuning ﬁve hyperparameters, exploration parameter
(“epsilon”), the target update rate, the discount factor, the learning rate, and the learning rate decay.
We allow for a maximum of 60 training episodes or 2000 training steps, whichever occurs ﬁrst. To
reduce noise, each “function evaluation” is taken to be an average of 10 independent training runs
of DQN. Figure 16 presents the optimization performance of various acquisition functions from the
different packages, using 15 rounds of parallel evaluations of size q = 4, over 100 trials. While
in later iterations all algorithms achieve reasonable performance, BOTORCH OKG , EI, NEI, and
GPyOpt LP-EI show faster learning early on.
Neural Network Surrogate: We consider the neural network surrogate model for the UCI Adult
data set introduced by Falkner et al. [22], which is available as part of HPOlib2 [ 21]. We use a
surrogate model to achieve a high level of precision in comparing the performance of the algorithms
without incurring excessive computational training costs. This is a six-dimensional problem over
network parameters (number of layers, units per layer ) and training parameters ( initial learning
rate, batch size, dropout, exponential decay factor for learning rate). Figure 17 shows optimization
performance in terms of best observed classiﬁcation accuracy. Results are means and 95% conﬁdence
intervals computed from 200 trials with 75 iterations of size q = 1 . All BOTORCH algorithms
perform quite similarly here, with OKG doing slightly better in earlier iterations. Notably, they all
achieve signiﬁcantly better accuracy than all other algorithms.
Stochastic Weight Averaging on CIFAR-10:Our ﬁnal example is for the recently proposedStochas-
tic Weight Averaging(SW A) procedure of Izmailov et al.[40], for which good hyperparameter settings
are not fully understood. The setting is 300 epochs of training on the VGG-16 [ 87] architecture
for CIFAR-10. We tune three SW A hyperparameters:learning rate, update frequency, and starting
iteration using OKG.
18

Izmailov et al. [40] report the mean and standard deviation of the test accuracy over three runs to be
93.64 and 0.18, respectively, which corresponds to a 95% conﬁdence interval of 93.64± 0.20. We
tune the problem to an average accuracy of 93.84± 0.03, outperforming Izmailov et al. [40], which
attained an accuracy of 93.64± 0.20.
D Additional Theoretical Results and Omitted Proofs
D.1 General SAA Results
Recall that we assume thatf(x)∼h(x,ϵ ) for someh : X× Rs→ Rq×m and base random variable
ϵ∈ Rs (c.f. Section 4 for an explicit expression forh in case of a GP model). We write
A(x,ϵ ) :=a(g(h(x,ϵ ))). (9)
Theorem 3 (Homem-de-Mello [39]). Suppose that (i) X is a compact metric space, (ii) ˆαN(x)
a.s.
−−→
α(x) for all x∈ Xq, and (iii) there exists an integrable function𝓁 : Rs↦→ R such that for almost
everyϵ and all x, y∈ X,
|A(x,ϵ )−A(y,ϵ )|≤ 𝓁(ϵ)‖x− y‖. (10)
Then ˆα∗
N
a.s.
−−→α∗ and dist(ˆx∗
N,X∗
f )
a.s.
−−→0.
Proposition 1. Suppose that (i) X is a compact metric space, (ii) f is a GP with continuously
differentiable prior mean and covariance functions, and (iii)g(·) anda(·, Φ) are Lipschitz continuous.
Then, condition (10) in Theorem 3 holds.
The following proposition follows directly from Proposition 2.1, Theorem 2.3, and remarks on page
528 of [39].
Proposition 2 (Homem-de-Mello [39]). Suppose that, in addition to the conditions in Theorem 3,
(i) the base samples E ={ϵi}N
i=1 are i.i.d., (ii) for all x∈ Xq the moment generating function
MA
x (t) := E[etA(x,ϵ)] ofA(x,ϵ ) is ﬁnite in an open neighborhood of t = 0 and (iii) the moment
generating functionM𝓁(t) := E[et𝓁(ϵ)] is ﬁnite in an open neighborhood oft = 0. Then, there exist
K <∞ andα> 1 such that P(dist(ˆxN,X∗
f ))≤Ke−αN for allN≥ 1.
D.2 Formal Statement of Theorem 1
Theorem 1 (Formal Version). Suppose (i) X is compact, (ii)f has a GP prior with continuously
differentiable mean and covariance functions, and (iii)g(·) anda(·, Φ) are Lipschitz continuous. If
the base samples{ϵi}N
i=1 are drawn i.i.d. fromN (0, 1), then
(1) ˆα∗
N→α∗ a.s., and
(2) dist(ˆx∗
N,X∗)→ 0 a.s.
If, in addition, (iii) for allx∈ Xq the moment generating functionMA
x (t) := E[etA(x,ϵ)] ofA(x,ϵ ) is
ﬁnite in an open neighborhood oft = 0 and (iv) the moment generating functionM𝓁(t) := E[et𝓁(ϵ)]
is ﬁnite in an open neighborhood oft = 0, then
(3) ∀δ >0,∃K <∞,α> 1 s.t. P
(
dist(ˆx∗
N,X∗)>δ
)
≤Ke−αN for allN≥ 1.
D.3 Randomized Quasi-Monte Carlo Sampling for Sample Average Approximation
In order to use randomized QMC methods with SAA for MC acquisition function, the base samples
E ={ϵi} will need to be generated via RQMC. For the case of Normal base samples, this can be
achieved in various ways, e.g. by using inverse CDF methods or a suitable Box-Muller transform of
samplesϵi∈ [0, 1]s (both approaches are implemented in BOTORCH ). In the language of Section 4,
such a transform will become part of the base sample transformϵ↦→h(x,ϵ ) for any ﬁxed x.
For the purpose of this paper, we consider scrambled (t,d )-sequences as discussed by Owen [70],
which are a particular class of RQMC method (BOTORCH uses PyTorch’s implementation of scram-
bled Sobol sequences, which are (t,d )-nets in base 2). Using recent theoretical advances from Owen
19

and Rudolf [72], it is possible to generalize the convergence results from Theorems 1 and 2 to the
RQMC setting (to our knowledge, this is the ﬁrst practical application of these theoretical results).
Let (Ni)i≥1 be a sequence withNi∈ N s.t.Ni→∞ asi→∞ . Then we have the following (see
Appendix D.5 for the proofs):
Theorem 1(q). In the setting of Theorem 1, let{ϵi} be samples from a (t,d )-sequence in baseb with
gain coefﬁcients no larger than Γ <∞, randomized using a nested uniform scramble as in [ 70].
Then, the conclusions of Theorem 1 still hold. In particular,
(1) ˆα∗
Ni→α∗ a.s. asi→∞ ,
(2) dist(ˆx∗
Ni,X∗)→ 0 a.s. asi→∞ ,
(3) ∀δ >0,∃K <∞,α> 1 s.t. P
(
dist(ˆx∗
Ni,X∗)>δ
)
≤Ke−αNi for alli≥ 1.
Theorem 2(q). In the setting of Theorem 2, let{ϵi} be samples from (t,d )-sequence in baseb, with
gain coefﬁcients no larger than Γ <∞, randomized using a nested uniform scramble as in [ 70].
Then,
(1) ˆα∗
KG,Ni
a.s.
−−→α∗
KG asi→∞ ,
(2) dist(ˆx∗
KG,Ni,X∗
KG)
a.s.
−−→0 asi→∞ .
(3) ∀δ >0,∃K <∞,α> 1 s.t. P
(
dist(ˆx∗
N,X∗)>δ
)
≤Ke−αN for allN≥ 1.
Theorem 2(q) as stated does not provide a rate on the convergence of the optimizer. We believe that
such result is achievable, but leave it to future work.
Note that while the above results hold for any sequence (Ni)i withNi→∞ , in practice the RQMC
integration error can be minimized by using sample sizes that exploit instinsic symmetry of the
(t,d )-sequences. Speciﬁcally, for integersb≥ 2 andM≥ 1, let
N :={mbk|m∈{ 1,...,M },k∈ N+}. (11)
In practice, we chose the MC sample sizeN from the unique elements ofN .
D.4 Asymptotic Optimality of OKG
Consider the case where ftrue is drawn from a GP prior with f
d
= ftrue, and that g(f)≡ f. The
KG policy (i.e., when used to select sequential measurements in a dynamic setting) is known to be
asymptotically optimal [26, 24, 77, 7], meaning that as the number of measurements tends to inﬁnity,
an optimal pointx∗∈X ∗
f := arg maxx∈Xf(x) is identiﬁed. Although it does not necessarily signify
good ﬁnite sample performance, this is considered a useful property for acquisition functions [24]. In
this section, we state two results showing that OKG also possesses this property, providing further
theoretical justiﬁcation for the MC approach taken by B OTORCH .
LetD0 be the initial data andDn forn≥ 1 be the data generated by taking measurements according
to OKG usingNn MC samples in iterationn, i.e., xn+1∈ arg maxx∈Xq ˆαKG,Nn(x;Dn) for alln,
and letχn∈ arg maxx∈X E[f(x)|Dn]. Then we can show the following:
Theorem 4. Suppose conditions (i) and (ii) of Theorem 1 and (iii) of Theorem 2 are satisﬁed. In
addition, suppose that lim supnNn =∞. Then,f(χn)→f(x∗) a.s. and inL1.
Theorem 4 shows that OKG is asymptotically optimal if the number of fantasiesNn grows asymptot-
ically withn (this assumes we have an analytic expression for the inner expectation. If not, a similar
condition must be imposed on the number of inner MC samples). In the special case of ﬁnite X, we
can quantify the sample sizes{Nn} that ensure asymptotic optimality of OKG:
Theorem 5. Along with conditions (i) and (ii) of Theorem 1, suppose that|X|<∞ andq = 1. Then,
if for someδ >0,Nn≥A−1
n log(Kn/δ) a.s., whereAn andKn are a.s. ﬁnite and depend onDn
(these quantities can be computed), we havef(χn)→ maxx∈Xf(x) a.s..
20

D.5 Proofs
In the following, we will denote by µD(x) := E[f(x) | D] and KD(x,y ) := E[(f(x)−
E[f(x)])(f(y)− E[f(y)])T |D ] the posterior mean and covariance functions of f conditioned
on dataD, respectively. Under some abuse of notation, we will useµD(x) andKD(x, y) to denote
multi point (vector / matrix)-valued variants ofµD andKD, respectively. Iff has a GP prior, then
the posterior mean and covarianceµD(x) andKD(x, y) have well-known explicit expressions [78].
For notational simplicity and without loss of generality, we will focus on single-output GP case
(m = 1 ) in this section. Indeed, in the multi-output case ( m > 1), we have a GP f on X× M
with M = {1,...,m }, and covariance function (x1,i 1), (x2,i 2) ↦→ ˜K((x1,i 1), (x2,i 2)). For
q = 1 we then deﬁne x↦→ ˜f(x) := [f(x, 0),...,f (x,m )], and then stack these for q > 1: x↦→
[ ˜f(x1)T,..., ˜f(xq)T ]T . Then the analysis in the proofs below can be done onmq-dimensional and
mq×mq-dimensional posterior mean and covariance matrices (instead ofq andq×q dimensional
ones form = 1). Differentiability assumptions are needed only to establish certain boundedness
results (e.g. in the proof of Proposition 1), but M is ﬁnite, so we will require differentiability of
K((·,i 1), (·,i 2)) for eachi1 andi2. Assumptions on other quantities can be naturally extended (e.g.
for Theorem 2g will need to be Lipschitz on Rq×m rather than on Rq, etc.).
Proof of Proposition 1 . Without loss of generality, we may assume m = 1 (the multi-output GP
case follows immediately from applying the result below toq′ =qm and re-arranging the output).
For a GP, we havehD(x,ϵ ) = µD(x) +LD(x)ϵ withϵ∼N (0,Iq), whereµD(x) is the posterior
mean and LD(x) is the Cholesky decomposition of the posterior covariance MD(x). It is easy
to verify from the classic GP inference equations [ 78] that if prior mean and covariance function
are continuously differentiable, then so are posterior meanµD(·) and covarianceKD(·). Since the
Cholesky decomposition is also continuously differentiable [ 64], so is LD(·). As X is compact
andµD(·) andLD(·) are continuously differentiable, their derivatives are bounded. It follows from
the mean value theorem that there exist Cµ,CL <∞ s.t.‖µD(x)−µD(y)‖≤ Cµ‖x− y‖ and
‖(LD(x)−LD(y))ϵ‖≤ CL‖ϵ‖‖x− y‖. Thus,
‖hD(x,ϵ )−hD(y,ϵ )‖ =‖µD(x)−µ(y) + (LD(x)−LD(y))ϵ‖
≤‖µD(x)−µD(y)‖ +‖(LD(x)−LD(y))ϵ‖
≤𝓁h(ϵ)‖x− y‖
where𝓁h(ϵ) :=Cµ +CL‖ϵ‖. Since, by assumption,g(·) anda(·; Φ)are Lipschitz (say with constants
La andLg, respectively), it follows that‖A(x,ϵ )−A(y,ϵ )‖≤ LaLg𝓁h(ϵ)‖x− y‖. It thus sufﬁces
to show that𝓁h(ϵ) is integrable. To see this, note that|𝓁h(ϵ)|≤ Cµ +CLC∑
i|ϵi| for someC <∞
(equivalence of norms), and thatϵi∼N (0, 1) is integrable.
Lemma 1. Suppose that (i)f is a GP with continuously differentiable prior mean and covariance
function, and (ii) thata(·, Φ) andg(·) are Lipschitz. Then, for all x∈ Xq the moment generating
functionsMA
x (t) := E[etA(x,ϵ)] ofA(x,ϵ ) andM𝓁(t) := E[et𝓁(ϵ)] are ﬁnite for allt∈ R.
Proof of Lemma 1 . Recall thathD(x,ϵ ) = µD(x) +LD(x)ϵ for the case off being a GP, where
µD(x) is the posterior mean andLD(x) is the Cholesky decomposition of the posterior covariance
KD(x). Mirroring the argument from the proof of Proposition 1, it is clear thatA(x,ϵ ) is Lipschitz
inϵ for each x∈ Xq, say with constant ˜CL. Note that this implies that E[|A(x,ϵ )|] <∞ for all
x. We can now appeal to results pertaining to the concentration of Lipschitz functions of Gaussian
random variables: the Tsirelson-Ibragimov-Sudakov inequality [10, Theorem 5.5] implies that
logMA
x (t)≤ t2 ˜C 2
L
2 +t E[A(x,ϵ )]
for anyt∈ R, which is clearly ﬁnite for all t since E[A(x,ϵ )]≤ E[|A(x,ϵ )|]. From the proof of
Proposition 1, we know thatA(x,ϵ ) is𝓁(ϵ)-Lipschitz in x, where𝓁(ϵ) is itself Lipschitz inϵ. Hence,
the concentration result in Theorem 5.5 of [10] applies again, and we are done.
Proof of Theorem 1 . Under the stated assumptions, Lemma 1 ensures that condition (10) in The-
orem 3 holds. Further, note that the argument about Lipschitzness of A(x,ϵ ) inϵ in the proof of
Lemma 1 implies that E[|A(x,ϵ )|]<∞ for all x∈ Xq. Since the{ϵi}N
i=1 are i.i.d, the strong law
21

of large numbers implies that ˆαN(x)→α(x) a.s. for allx∈ X. Claims (1) and (2) then follow by
applying Theorem 3, and claim (3) follows by applying Proposition 2.
Proof of Theorem 1(q) . Mirroring the proof of Theorem 1, we need to show that ˆαNi(x)→α(x)
a.s. as i→∞ for all x∈ Xq. For any x∈ Xq and any ϵ0∈ Rq, we have (by convexity and
monotonicity of|x|↦→| x|2 and the Lipschitz assumption ona andg) that
|A(x,ϵ )|2 =|A(x,ϵ 0) +A(x,ϵ )−A(x,ϵ 0)|2
≤|A(x,ϵ 0)|2 +|A(x,ϵ )−A(x,ϵ 0)|2
≤|A(x,ϵ 0)|2 +L2
aL2
g‖hD(x,ϵ )−hD(x,ϵ 0)‖2
wherehD(x,ϵ ) =µD(x) +LD(x)Φ−1(ϵ) with Φ−1 the inverse CDF ofN (0, 1), applied element-
wise to the vectorϵ of qMC samples. Now chooseϵ0 = (0.5,..., 0.5), then
|A(x,ϵ )|2≤|a(g(0))|2 +L2
aL2
g‖hD(x,ϵ )‖2
Since the{ϵi} are generated by a nested uniform scramble, we know from Owen [70] thatϵ∼
U[0, 1]q, and therefore Φ−1(ϵ) ∼ N(0,Iq). Since afﬁne transformations of Gaussians remain
Gaussian, we have that E
[
‖hD(x,ϵ )‖2]
< ∞. This shows that A(x,ϵ ) ∈ L2([0, 1]q). That
ˆαNi(x)→ 0 a.s. asi→∞ for all x∈ Xq now follows from Owen and Rudolf [72, Theorem 3].
Lemma 2. Iff is a GP , thenfDx(x′) = h(x′, x,ϵ,ϵ I), whereϵ∼N (0,Iq) andϵI∼N (0, 1) are
independent andh is linear in bothϵ andϵI.
Proof of Lemma 2 . This essentially follows from the property of a GP that the covariance con-
ditioned on a new observation (x,y ) is independent of y.6 We can write fDx(x′) = µDx(x′) +
Lσ
Dx(x′)ϵI , where
µDx(x′) :=µD(x′) +KD(x′, x)Kσ
D(x)−1Lσ
D(x)ϵ,
Lσ
D(x) is the Cholesky decomposition of Kσ
D(x) := KD(x, x) + diag(σ2(x1),...,σ 2(xq)), and
Lσ
Dx(x′) is the Cholesky decomposition of
KDx(x′,x′) :=K(x′,x′)−KD(x′, x)Kσ
D(x)−1KD(x,x′).
Hence, we see thatfDx(x′) =h(x′, x,ϵ,ϵ I), with
h(x′, x,ϵ,ϵ I) =µD(x′) +KD(x′, x)Kσ
D(x)−1Lσ
D(x)ϵ +Lσ
Dx(x′)ϵI, (12)
which completes the argument.
Theorem 6. Let (an)n≥1 be a sequence of non-negative real numbers such thatan→ 0. Suppose
that (i) X is a compact metric space, (ii) f is a GP with continuous sample paths and continuous
variance functionx↦→ σ2(x), and (iii) (xn)n≥1 is such that αn
KG(xn) > supx∈Xqαn
KG(x)−an
inﬁnitely often almost surely. Thenαn
KG(x)→ 0 a.s. for all x∈ Xq.
Proof of Theorem 6 . Bect et al. [7] provide a proof for the caseq = 1. Following their exposition,
one ﬁnds that the only thing that needs to be veriﬁed in order to generalize their results toq >1 is that
condition (c) in their Deﬁnition 3.18 holds also for the caseq >1. What follows is the multi-point
analogue of step (f) in the proof of their Theorem 4.8, which establishes this.
Letµ : X→ R andK : X× X→ R+ denote mean and covariance function of f. Let Zx :=
f(x) + diag(σ(x)), where σ(x) := ( σ(x1),...,σ (xq)), with ϵ ∼ N(0,Id) independent of f.
Moreover, letx∗∈ arg maxµ(x). Following the same argument as Bect et al. [7], we arrive at the
intermediate conclusion that E[max{0,W x,y}] = 0, whereWx,y := E[f(y)|Zx]− E[f(x∗)|Zx].
We need to show that this implies that maxx∈Xf(x) =m(x∗).
6In some cases we may consider constructing a heteroskedastic noise model that results in the functionσ2(x)
changing depending on observationsy, in which case this argument does not hold true anymore. We will not
consider this case further here.
22

Under some abuse of notation we will useµ andK also as the vector / matrix-valued mean / kernel
function. LetKσ(x) :=K(x, x) + diag(σ(x)) and observe that
Wx,y =µ(y)−µ(x∗) + 1 {C(x)≻0}(K(y, x)−K(x∗, x))Kσ(x)−1(Zx−µ(x)),
i.e., Wx,y is Gaussian with Var(Wx,y) = V (x,y,x∗)V (x,y,x∗)T , where V (x,y,x∗) :=
(K(y, x)−K(x∗, x))Kσ(x)−1. Since E[max{0,W x,y}] = 0, we must have that Var(Wx,y) = 0.
IfKσ(x)≻ 0, this means that (K(y, x)−K(x∗, x)) = 0q. But if Kσ(x)⁄≻ 0, thenK(x, x)⁄≻ 0,
which in turn implies that K(y, x) = K(x∗, x) = 0 q. This shows that K(y, x) = K(x∗, x)
for all y ∈ X and all x ∈ X. In particular, K(x,y ) = K(x,x∗) for all y ∈ X. Thus,
K(x,x )−K(x,y ) = K(x,x∗)−K(x,x∗) for all y,x ∈ X, and therefore Var(f(x)−f(y)) =
K(x,x )−K(x,y )−K(y,x ) +K(y,y ) = 0. As in [ 7] we can conclude that this means that the
sample paths off−µ are constant over X, and therefore maxx∈Xf(x) =m(x∗).
Proof of Theorem 2 . From Lemma 2 we have thatfDx(x′) =h(x′, x,ϵ,ϵ I) withh as in (12). With-
out loss of generality, we can absorbϵI intoϵ for the purposes of showing that condition (10) holds
for the mappingAKG(x,ϵ ) := maxx′∈X E
[
g(f(x′))|D x
]
. Since the afﬁne (and thus, continuously
differentiable) transformationg preserves the necessary continuity and differentiability properties, we
can follow the same argument as in the proof of Theorem 1 of [102]. In particular, using continuous
differentiability of GP mean and covariance function, compactness of X, and continuous differentia-
bility ofg, we can apply the envelope theorem in the same fashion. From this, it follows that for any
ϵ∈ Rq and for each 1≤l≤q, 1≤k≤d, the restriction of x↦→AKG(x,ϵ ) to thek,l -th coordinate
is absolutely continuous for all x, thus the partial derivative∂xlkAKG(x,ϵ ) exists a.e. Further, for
eachl there exist Λl∈ Rq with‖Λl‖<∞ s.t.|∂xklAKG(x,ϵ )|≤ ΛT
l|ε| a.e. on Xq (here|·| denotes
the element-wise absolute value of a vector). This uniform bound on the partial derivatives can be
used to show thatAKG is𝓁(ϵ)-Lipschitz. Indeed, writing the differenceAKG(y,ϵ )−AKG(x,ϵ ) as a
sum of differences in each of theqd components of x and y, respectively, using the triangle inequality,
absolute continuity of the element-wise restrictions, and uniform bound on the partial derivatives, we
have that
|AKG(y,ϵ )−AKG(x,ϵ )|≤
q∑
k=1
d∑
l=1
ΛT
l|ϵ||ykl− xkl|≤ max
1≤l≤d
{
ΛT
l|ϵ|
}
‖y− x‖1
and so𝓁(ϵ) = maxl{ΛT
l|ϵ|}. Going back to viewingϵ as a random variable, it is straightforward to
verify that𝓁(ϵ) is integrable. Indeed,
E[|𝓁(ϵ)|]≤ max
l
{∑q
k=1 ΛlkE[|ϵk|]} =
√
2/π max
l
{‖Λl‖1}.
Sinceg is assumed to be afﬁne in (iii), we can apply Lemma 2 to see that E[g(f(x′))|D x] is a
GP. Therefore,AKG(x,ϵ ) represents the maximum of a GP and its moment generating function
E[etAKG(x,ϵ)] is ﬁnite for all t by Lemma 4. This implies ﬁniteness of its absolute moments [ 60,
Exercise 9.15] and we have that E[|AKG(x,ϵ )|] <∞ for all x∈ X. Since the {ϵi} are i.i.d, the
strong law of large numbers ensures that ˆαKG,N(x)→αKG(x) a.s. Theorem 3 now applies to obtain
(1) and (2).
Moreover, by the analysis above, it holds that
𝓁(ϵ) = max
l
{ΛT
l|ϵ|}≤ q max
l
‖ΛT
l‖∞‖ϵ‖∞ =:𝓁′(ϵ),
so𝓁′(ϵ) is also a Lipschitz constant forAKG(·,ϵ ). Here, the absolute value version (the second result)
of Lemma 4 applies, so we have that E[et𝓁′(ϵ)] is ﬁnite for allt. The conditions of Proposition 2 are
now satisﬁed and we have the desired conclusion.
Proof of Theorem 2(q) . In the RQMC setting, we have by Owen [70] thatϵ∼U[0, 1]q. Therefore,
we are now interested in examining ˜AKG(x,ϵ ) := AKG(x, Φ−1(ϵ)), since Φ−1(ϵ)∼N (0,Iq).
Following the same analysis as in the proof of Theorem 2, we have Lipschitzness of ˜AKG(·,ϵ ):
| ˜AKG(y,ϵ )− ˜AKG(x,ϵ )|≤ 𝓁(Φ−1(ϵ))‖y− x‖1,
23

where𝓁(·) is as deﬁned in the proof of Theorem 2. As before, 𝓁(Φ−1(ϵ)) is integrable. Like in
the proof of Theorem 2, ˜AKG(x,ϵ ) is the maximum of a GP and its moment generating func-
tion E[et ˜AKG(x,ϵ)] is ﬁnite for all t by Lemma 4, implying ﬁniteness of its second moment:
E[ ˜AKG(x,ϵ )2]<∞ for all x∈ X. Thus, that ˜AKG(x,ϵ )∈L2([0, 1]q) and ˆαKG,Ni(x)→αKG(x)
a.s. as i→∞ for all x∈ Xq follows from Owen and Rudolf [72, Theorem 3]. Theorem 3 now
allows us to conclude (1) and (2).
The following Lemma will be used to prove Theorem 4:
Lemma 3. Consider a Gaussian Processf on X⊂ Rd with covariance functionK(·,·) : X×X→ R.
Suppose that (i) X is compact, and (ii) K is continuously differentiable. Then f has continuous
sample paths.
Proof of Lemma 3. SinceK is continuously differentiable andX is compact,K is Lipschitz on X×X,
i.e.,∃L< ∞ such that|K(x,y )−K(x′,y′)|≤ L
(
‖x−x′‖+‖y−y′‖
)
for all (x,y ), (x′,y′)∈ X×X.
Thus
E|f(x)−f(x)|2 =K(x,x )− 2K(x,y ) +K(y,y )
≤|K(x,x )−K(x,y )| +|K(y,y )−K(x,y )|
≤ 2L‖x−y‖
Since X is compact, there existsC := maxx,y∈X‖x−y‖<∞. With this it is easy to verify that
there exist C′ <∞ andη > 0 such that 2L‖x−y‖ < C′| log‖x−y‖|−(1+η) for all x,y ∈ X.
Continuity of the sample paths then follows from Theorem 3.4.1 in [3].
Proof of Theorem 4 . From Lemma 3 we know that the GP has continuous sample paths. If xn+1∈
arg maxx∈Xq ˆαn
KG,Nn(x) for alln, the almost sure convergence of ˆxn
KG,Nn to the set of optimizers
ofαn
KG from Theorem 2 together with continuity of αn
KG (established in the proof of Theorem 2)
implies that for allδ >0 and eachn≥ 1,∃Nn <∞ such thatαn
KG(xn+1)> supx∈Xqαn
KG(x)−δ.
As lim supnNn =∞,∃ (an)n≥1 withan→ 0 such that αn
KG(xn+1) > supx∈Xqαn
KG(x)−an
inﬁnitely often. Thatαn
KG(x)→ 0 a.s. for all x∈ Xq then follows from Theorem 6. The convergence
result forf(χn) then follows directly from Proposition 4.9 in [7].
Lemma 4. Letf be a mean zero GP deﬁned on X such that|f(x)| <∞ almost surely for each
x∈ X. It holds that the moment generating functions of supx∈Xf(x) and supx∈X|f(x)| are both
ﬁnite, i.e.,
E
[
et supx∈Xf (x)]
<∞ and E
[
et supx∈X|f (x)|]
<∞
for anyt∈ R.
Proof of Lemma 4 . Let‖f‖ := supx∈Xf. Since the sample paths off are almost surely ﬁnite, the
Borell-TIS inequality [2, Theorem 2.1] states that E‖f‖<∞. We ﬁrst considert> 0 and begin by
re-writing the expectation as
E
[
et‖f‖]
=
∫ ∞
0
P
(
et‖f‖ >u
)
du
≤ 1 +
∫ ∞
1
P
(
et‖f‖ >u
)
du
= 1 +
∫ ∞
1
P
(
‖f‖− E‖f‖>t−1 logu− E‖f‖
)
du
= 1 +tet E‖f‖
∫ ∞
−E‖f‖
P
(
‖f‖− E‖f‖>u
)
etudu
≤ 1 +tet E‖f‖
[∫ 0
min{−E‖f‖, 0}
+
∫ ∞
0
]
P
(
‖f‖− E‖f‖>u
)
etudu
≤ 1 +
⏐⏐E‖f‖
⏐⏐tet E‖f‖ +tet E‖f‖
∫ ∞
0
P
(
‖f‖− E‖f‖>u
)
etudu, (13)
24

where a change of variables is performed in the third equality. Letσ2
X := supx∈X E[f(x)2]. We can
now use the Borell-TIS inequality to bound the tail probability in (13) by 2e−u2/(2σ2
X), obtaining:
E
[
et‖f‖]
≤ 1 +
⏐⏐E‖f‖
⏐⏐tet E‖f‖ +tet E‖f‖
∫ ∞
0
2e−u2/(2σ2
X)+tudu< ∞.
Similarly, fort< 0, we have:
E
[
et‖|f|‖]
=
∫ ∞
0
P
(
et‖|f|‖ >u
)
du
≤ 1 +
∫ ∞
1
P
(
et‖|f|‖ >u
)
du
= 1 +
∫ ∞
1
P
(
‖|f|‖− E‖f‖<t−1 logu− E‖f‖
)
du
= 1−tet E‖f‖
∫ −E‖f‖
−∞
P
(
‖|f|‖− E‖f‖<u
)
etudu
≤ 1−tet E‖f‖
[∫ max{−E‖f‖, 0}
0
+
∫ 0
−∞
]
P
(
‖|f|‖− E‖f‖<u
)
etudu
≤ 1−
⏐⏐E‖f‖
⏐⏐tet E‖f‖−tet E‖f‖
∫ 0
−∞
P
(
‖|f|‖− E‖f‖<u
)
etudu, (14)
The same can be done for (14) to conclude that E
[
et‖f‖]
<∞ for allt. For the case of E
[
et‖|f|‖]
andt> 0, we use a similar line of analysis as (13) along with the observation that
P
(
‖|f|‖− E‖f‖>u
)
≤ 2 P
(
‖f‖− E‖f‖>u
)
.
Fort< 0, the result is clear because‖|f|‖≥ 0.
Proof of Theorem 5 . Since we are in the case of ﬁnite X, letµn and Σn denote the posterior mean
vector and covariance matrix of our GP after conditioning onDn. First, we give a brief outline of
the argument. We know from previous work (Lemma A.6 of [24] or Lemma 3 of [77]) that given a
posterior distribution parameterized byµ and Σ, ifαKG(x;µ, Σ) = 0 for allx∈ X, then an optimal
design is identiﬁed:
arg max
x∈X
µ(x) = arg max
x∈X
f(x)
almost surely. Thus, we can use the true KG values as a “potential function” to quantify how the
OKG policy performs asymptotically, even though we are never using the KG acquisition function
for selecting points. We emphasize that the data that induce{µn}n≥0 and{Σn}n≥0 are collected
using the OKG policy.
By a martingale convergence argument, there exists a limiting posterior distribution described by
random variables (µ∞, Σ∞), i.e.,µn→µ∞ and Σn→ Σ∞ almost surely [24, Lemma A.5]. Let
A⊆ X be a subset of the feasible space. As was done in the proof of Theorem 4 of [24], we deﬁne
the event:
HA =
{
αKG(x;µ∞, Σ∞)> 0, x∈A
}
∩
{
αKG(x;µ∞, Σ∞) = 0, x⁄∈A
}
. (15)
Note that HA, for all possible subsets A, partition the sample space. Consider some A⁄=∅. By
Lemma A.7 of [24], ifαKG(x;µ∞, Σ∞)> 0, thenx is measured a ﬁnite number of times, meaning
that there exists an almost surely ﬁnite random variableM0 such that on iterations afterN0, OKG
stops sampling fromA. By the deﬁnition of HA in (15), there must exist another random iteration
indexM1≥M0 such that whenn≥N1,
min
x∈A
αKG(x;µn, Σn)> max
x⁄∈A
αKG(x;µn, Σn),
implying that the exact KG policy must prefer points inA over all others after iterationM1. This
implies that
HA⊆
{
arg max
x∈X
ˆαKG,Nn(x,µn, Σn)⁄⊆ arg max
x∈X
αKG(x,µn, Σn),∀n≥M1− 1
}
=:E,
25

because if not, then there exists an iteration afterM0 where an element fromA is selected, which is a
contradiction. As shown in the proof of Lemma 2, the next period posterior mean E
[
g(f(x′))|D x
]
is a GP. Therefore, by Lemma 4, the moment generating function of maxx′∈X E
[
g(f(x′))|D x
]
is
ﬁnite. Theorem 2.6 of [39] establishes that our choice of Nn guarantees
P
[
arg max
x∈X
ˆαKG,Nn(x,µn, Σn)⁄⊆ arg max
x∈X
αKG(x,µn, Σn)|Fn
]
≤δ,
from which it follows that
∞∑
n=0
log P
[
arg max
x∈X
ˆαKG,Nn(x,µn, Σn)⁄⊆ arg max
x∈X
αKG(x,µn, Σn)|Fn
]
=−∞.
After writing the probability of E as an inﬁnite product and performing some manipulation, we
see that the above condition implies that the probability of event E is zero, and we conclude that
P(HA) = 0 for any nonemptyA. Therefore, P(H∅) = 1 andαKG(x;µ∞, Σ∞) = 0 for allx almost
surely.
E Illustration of Sample Average Approximation
QMC methods have been used in other applications in machine learning, including variational
inference [12] and evolutionary strategies [80], but rarely in BO. Letham et al. [55] use QMC in the
context of a speciﬁc acquisition function. BOTORCH ’s abstractions make it straightforward (and
mostly automatic) to use QMC integration with any acquisition function.
Using SAA, i.e., ﬁxing the base samples E ={ϵi}, introduces a consistent bias in the function
approximation. While i.i.d. re-sampling in each evaluation ensures that ˆαN(x, Φ,D) and ˆαN(y, Φ,D)
are conditionally independent given (x, y), this no longer holds when ﬁxing the base samples.
0.0
0.1
0.2
0.3EI
MC, n=32
analytic
qMC, n=32
analytic
0.0 0.2 0.4 0.6 0.8 1.0
0.0
0.1
0.2
0.3EI
MC, n=32 (fixed)
analytic
0.0 0.2 0.4 0.6 0.8 1.0
qMC, n=32 (fixed)
analytic
Figure 18: MC and QMC acquisition functions, with and without re-drawing the base samples between
evaluations. The model is a GP ﬁt on 15 points randomly sampled from X = [0, 1]6 and evaluated on the
(negative) Hartmann6 test function. The acquisition functions are evaluated along the slicex(λ) =λ1.
Figure 18 illustrates this behavior for EI (we consider the simple case ofq = 1 for which we have an
analytic ground truth available). The top row shows the MC and QMC version, respectively, when
re-drawing base samples for every evaluation. The solid lines correspond to a single realization, and
the shaded region covers four standard deviations around the mean, estimated across 50 evaluations.
It is evident that QMC sampling signiﬁcantly reduces the variance of the estimate. The bottom
row shows the same functions for 10 different realizations of ﬁxed base samples. Each of these
realizations is differentiable w.r.t.x (and henceλ in the slice parameterization). In expectation (over
the base samples), this function coincides with the true function (the dashed black line). Conditional
on the base sample draw, however, the estimate displays a consistent bias. The variance of this bias
(across re-drawing the base samples) is much smaller for the QMC versions.
Even thought the function values may show noticeable bias, the bias of the maximizer (in X) is
typically very small. Figure 19 illustrates this behavior, showing empirical cdfs of the relative gap
26

0.00 0.02 0.04 0.06 0.08 0.10 0.12 0.14
1 (x*
N )/ (x * )
0.00
0.25
0.50
0.75
1.00empirical/uni00A0CDF
relative/uni00A0gap/uni00A0at/uni00A0optimizer
N=128
N=64
N=32
N=16
0.00 0.02 0.04 0.06 0.08 0.10
||x * x*
N ||2
distance/uni00A0of/uni00A0optimizers
N=128
N=64
N=32
N=16
Figure 19: Performance for optimizing QMC-based EI. Solid lines: ﬁxed base samples, optimized via L-BFGS-B.
Dashed lines: re-sampling base samples, optimized via Adam (lr=0.025).
1−α(ˆx∗
N)/α(x∗) and the distance‖x∗− ˆx∗
N‖2 over 250 optimization runs for different numbers
of samples, where x∗ is the optimizer of the analytic function EI, and ˆx∗
N is the optimizer of the
QMC approximation. The quality of the solution of the deterministic problem is excellent even for
relatively small sample sizes, and generally better than of the stochastic optimizer.
Figure 20 shows empirical mean and variance of the metrics from Figure 19 as a function of the
number of MC samplesN on a log-log scale. The stochastic optimizer used is Adam with a learning
rate of 0.025. Both for the SAA and the stochastic version we use the same number of random restart
initial conditions generated from the same initialization heuristic.
Empirical asymptotic convergence rates can be obtained as the slopes of the OLS ﬁt (dashed lines),
and are given in Table 1. It is quite remarkable that in order to achieve the same error as the MC
approximation with 4096 samples, the QMC approximation only requires 64 samples. This holds true
for the bias and variance of the (relativized) optimal value as well as for the distance from the true
optimizer. That said, as we are in a BO setting, we are not necessarily interested in the estimation
error ˆα∗
N−α∗ of the optimum, but primarily in how farx∗
N is from the true optimizerx∗.
30
25
20
15
10
log2E[1 (x *
N )/ * ]
optimal/uni00A0value,/uni00A0bias
MC/uni00A0(SAA)
MC/uni00A0(re/uni00ADsample)
qMC/uni00A0(SAA)
qMC/uni00A0(re/uni00ADsample) 15.0
12.5
10.0
7.5
5.0
log2E[||x *
N x * ||2]
optimizer,/uni00A0bias/uni00A0(2/uni00ADnorm)
MC/uni00A0(SAA)
MC/uni00A0(re/uni00ADsample)
qMC/uni00A0(SAA)
qMC/uni00A0(re/uni00ADsample)
16 64 256 1024 4096
N
60
50
40
30
20
log2Var(1 (x *
N )/ * )
optimal/uni00A0value,/uni00A0variance
MC/uni00A0(SAA)
MC/uni00A0(re/uni00ADsample)
qMC/uni00A0(SAA)
qMC/uni00A0(re/uni00ADsample)
16 64 256 1024 4096
N
35
30
25
20
15
10
log2Var(||x *
N x * ||2)
optimizer,/uni00A0variance/uni00A0(2/uni00ADnorm)
MC/uni00A0(SAA)
MC/uni00A0(re/uni00ADsample)
qMC/uni00A0(SAA)
qMC/uni00A0(re/uni00ADsample)
Figure 20: Bias and variance of optimizerx∗
N and true EI value EI(x∗
N) evaluated at the optimizer as a function
of the number of (Q)MC samples for both SAA and stochastic optimzation (“re-sample”).
MC QMC MC † QMC†
E[1− ˆα∗
N/α∗] −0.52 −0.95 −0.10 −0.26
Var(1− ˆα∗
N/α∗) −1.16 −2.11 −0.19 −0.35
E[‖x∗
N−x∗‖2] −1.04 −1.94 −0.16 −0.47
Var(‖x∗
N−x∗‖2) −2.24 −4.14 −0.30 −0.63
Table 1: Empirical asymptotic convergence rates for the setting in Figure 20 (†denotes re-sampling + optimization
with Adam).
27

A somewhat subtle point is that whether better optimization of the acquisition function results in
improved closed-loop BO performance depends on the acquisition function as well as the underlying
problem. More exploitative acquisition functions, such as EI, tend to show worse performance for
problems with high noise levels. In these settings, not solving the EI maximization exactly adds
randomness and thus induces additional exploration, which can improve closed-loop performance.
While a general discussion of this point is outside the scope of this paper, BOTORCH does provide
a framework for optimizing acquisition functions well, so that these questions can be compartmen-
talized and acquisition function performance can be investigated independently from the quality of
optimization.
Perhaps the most signiﬁcant advantage of using deterministic optimization algorithms is that, unlike
for algorithms such as SGD that require tuning the learning rate, the optimization procedure is
essentially hyperparameter-free. Figure 8 shows the closed-loop optimization performance of qEI
for both deterministic and stochastic optimization for different optimizers and learning rates. While
some of the stochastic variants (e.g. ADAM with learning rate 0.01) achieve performance similar
to the deterministic optimization, the type of optimizer and learning rate matters. In fact, the rank
order of SGD and ADAM w.r.t. to the learning rate is reversed, illustrating that selecting the right
hyperparameters for the optimizer is itself a non-trivial problem.
F Active Learning Example
Recall from Section 5.1 the negative integrated posterior variance (NIPV) [85, 16] of the model:
NIPV(x) =−
∫
X
E
[
Var(f(x)|D x)|D
]
dx. (16)
We can implement (16) using standard BOTORCH components, as shown in Code Example 3. Here
mc_points is the set of points used for MC-approximating the integral. In the most basic case,
one can use QMC samples drawn uniformly in X. By allowing for arbitrary mc_points, we permit
weighting regions of X using non-uniform sampling. Using mc_points as samples of the maximizer
of the posterior, we recover the recently proposed Posterior Variance Reduction Search [67] for BO.
class q N e g a t i v e I n t e g r a t e d P o s t e r i o r V a r i a n c e ( A n a l y t i c A c q u i s i t i o n F u n c t i o n ) :
@ c o n c a t e n a t e _ p e n d i n g _ p o i n t s
@ t _ b a t c h _ m o d e _ t r a n s f o r m ()
def forward ( self , X : Tensor ) -> Tensor :
f a n t _ m o d e l = self . model . f a n t a s i z e (
X =X , sampler = self . _dummy_sampler ,
o b s e r v a t i o n _ n o i s e = True
)
sz = [1] * len ( X . shape [: -2]) + [ -1 , X . size ( -1) ]
m c _ p o i n t s = self . m c _ p o i n t s . view (* sz )
with se tt ing s . p r o p a g a t e _ g r a d s ( True ) :
p o s t e r i o r = f a n t _ m o d e l . p o s t e r i o r ( m c _ p o i n t s )
ivar = p o s t e r i o r . va ri an ce . mean ( dim = -2)
return - ivar . view ( X . shape [: -2])
Code Example 3: Active Learning (NIPV)
This acquisition function supports both parallel selection of points and asynchronous evaluation.
Since MC integration requires evaluating the posterior variance at a large number of points, this
acquisition function beneﬁts signiﬁcantly from the fast predictive variance computations in GPyTorch
[75, 28].
To illustrate how NIPV may be used in combination with scalable probabilistic modeling, we examine
the problem of efﬁcient allocation of surveys across a geographic region. Inspired by Cutajar et al.
[17], we utilize publicly-available data from The Malaria Atlas Project (2019) dataset, which includes
the yearly mean parasite rate (along with standard errors) of Plasmodium falciparum at a 4.5km2
grid spatial resolution across Africa. In particular, we consider the following active learning problem:
given a spatio-temporal probabilistic model ﬁt to data from 2011-2016, which geographic locations
in and around Nigeria should one sample in 2017 in order to minimize the model’s error for 2017
across all of Nigeria?
28

We ﬁt a heteroskedastic GP model to 2500 training points prior to 2017 (using a noise model that
is itself a GP ﬁt to the provided standard errors). We then selectq = 10 sample locations for 2017
using the NIPV acquisition function, and make predictions across the entirety of Nigeria using this
new data. Compared to using no 2017 data, we ﬁnd that our new dataset reduces MSE by 16.7% on
average (SEM = 0.96%) across 60 subsampled datasets. By contrast, sampling the new 2017 points at
a regularly spaced grid results only in a 12.4% reduction in MSE (SEM = 0.99%). The mean relative
improvement in MSE reduction from NIPV optimization is 21.8% (SEM = 6.64%). Figure 21 shows
the NIPV-selected locations on top of the base model’s estimated parasite rate and standard deviation.
Figure 21: Locations for 2017 samples from IPV minimization and the base grid. Observe how the NIPV
samples cluster in higher variance areas.
G Additional Implementation Details
G.1 Batch Initialization for Multi-Start Optimization
For most acquisition functions, the optimization surface is highly non-convex, multi-modal, and
(especially for “improvement-based” ones such as EI or KG) often ﬂat (i.e. has zero gradient) in
much of the domain X. Therefore, optimizing the acquisition function is itself a challenging problem.
The simplest approach is to use zeroth-order optimizers that do not require gradient information, such
as DIRECT or CMA-ES [43, 37]. These approaches are feasible for lower-dimensional problems,
but do not scale to higher dimensions. Note that performing parallel optimization overq candidates
in ad-dimensional feature space means solving aqd-dimensional optimization problem.
A more scalable approach incorporates gradient information into the optimization. As described in
Section 4, BOTORCH by default uses quasi-second order methods, such as L-BFGS-B. Because of
the complex structure of the objective, the initial conditions for the algorithm are extremely important
so as to avoid getting stuck in a potentially highly sub-optimal local optimum. To reduce this risk,
one typically employs multi-start optimization (i.e. start the solver from multiple initial conditions
and pick the best of the ﬁnal solutions). To generate a good set of initial conditions, BOTORCH
heavily exploits the fast batch evaluation discussed in the previous section. Speciﬁcally, BOTORCH
by default usesNopt initialization candidates generated using the following heuristic:
1. Sample ˜N0 quasi-randomq-tuples of points ˜x0∈ R ˜N0×q×d from Xq using quasi-random Sobol
sequences.
29

2. Batch-evaluate the acquisition function at these candidate sets: ˜v =α(˜x0; Φ,D).
3. SampleN0 candidate sets x∈ RN0×q×d according to the weight vector p∝ exp(ηv), where
v = (˜v− ˆµ(˜v))/ˆσ(˜v) with ˆµ and ˆσ the empirical mean and standard deviation, respectively, and
η >0 is a temperature parameter. Acquisition functions that are known to be ﬂat in large parts
of Xq are handled with additional care in order to avoid starting in locations with zero gradients.
Sampling initial conditions this way achieves an exploration/exploitation trade-off controlled by
the magnitude ofη. Asη→ 0 we perform Sobol sampling, whileη→∞ means the initialization
is chosen in a purely greedy fashion. The latter is generally not advisable, since for large ˜N0 the
highest-valued points are likely to all be clustered together, which would run counter to the goal of
multi-start optimization. Fast batch evaluation allows evaluating a large number of samples ( ˜N0 in
the tens of thousands is feasible even for moderately sized models).
G.2 Sequential Greedy Batch Optimization
The pending points approach discussed in Section 5 provides a natural way of generating parallel BO
candidates using sequential greedy optimization, where candidates are chosen sequentially, while
in each step conditioning on selected points and integrating over the uncertainty in their outcome
(using MC integration). By using a full MC formulation, in which we jointly sample at new and
pending points, we avoid constructing an individual “fantasy” model for each sampled outcome, a
common (and costly) approach in the literature [88]. In practice, the sequential greedy approach often
performs well, and may even outperform the joint optimization approach, since it involves a sequence
of small, simpler optimization problems, rather than a larger and complex one that is harder to solve.
[98] provide a theoretical justiﬁcation for why the sequential greedy approach works well with a class
of acquisition functions that are submodular.
H Additional Implementation Examples
Comparing Implementation Complexity
Many of BOTORCH ’s beneﬁts are qualitative, including the simpliﬁcation and acceleration of im-
plementing new acquisition functions. Quantifying this in a meaningful way is very challenging.
Comparisons are often made in terms of Lines of Code (LoC) - while this metric is problematic when
comparing across different design philosophies, non-congruent feature sets, or even programming
languages, it does provides a general idea of the effort required for developing and implementing new
methods.
MOE’s KG involves thousands of LoC in C++ and python spread across a large number of ﬁles,7
while our more efﬁcient implementation is <30 LoC. Astudillo and Frazier [6] is a full paper in
last year’s installment of this conference,8 whose composite function method we implement and
signiﬁcantly extend (e.g to support KG) in 7 LoC using BoTorch’s abstractions. The original NEI
implementation is >250 LoC, while the one from Code Example 1 is 14 LoC.
H.1 Composite Objectives
We consider the Bayesian model calibration of a simulator with multiple outputs from Section
5.3 of Astudillo and Frazier [6]. In this case, the simulator from Bliznyuk et al. [9] models the
concentrations of chemicals at 12 positions in a one-dimensional channel. Instead of modeling the
overall loss function (which measures the deviation of the simulator outputs with a set of observations)
directly, we follow Astudillo and Frazier [6] and model the underlying concentrations while utilizing
a composite objective approach. A powerful aspect of BOTORCH ’s modular design is the ability to
easily combine different approaches into one. For the composite function problem in this section this
means that we can easily extend the work by Astudillo and Frazier [6] not only to use the Knowledge
Gradient, but also to the “parallel BO” setting of jointly selectingq >1 points. Figures 22 and 22
show results for this withq = 1 andq = 3, repspectively. The plots show log regret evaluated at the
maximizer of the posterior mean averaged over 250 trials. While the performance of EI-CF is similar
7https://github.com/wujian16/Cornell-MOE
8Code available at https://github.com/RaulAstudillo06/BOCF
30

5 10 15 20 25 30 35
Number/uni00A0of/uni00A0function/uni00A0evaluations
5
4
3
2
1
0
log10/uni00A0regret
RND
RND/uni00A0CF
EI
EI/uni00A0CF
OKG
OKG/uni00A0CF
Figure 22: Composite function optimization forq = 1
5 10 15 20 25 30
Number/uni00A0of/uni00A0function/uni00A0evaluations
5
4
3
2
1
0
log10/uni00A0regret
RND
RND/uni00A0CF
EI
EI/uni00A0CF
OKG
OKG/uni00A0CF Figure 23: Composite function optimization forq = 3
class q U p p e r C o n f i d e n c e B o u n d ( M C A c q u i s i t i o n F u n c t i o n ) :
def __init__ (
self ,
model : Model ,
beta : float ,
sampler : Optional [ MC Sam pl er ] = None ,
ob je ct iv e : Optional [ M C A c q u i s i t i o n O b j e c t i v e ] = None ,
X_ pe nd in g : Optional [ Tensor ] = None ,
) -> None :
super () . __init__ ( model , sampler , objective , X_ pen di ng )
self . b e t a _ p r i m e = math . sqrt ( beta * math . pi / 2)
@ c o n c a t e n a t e _ p e n d i n g _ p o i n t s
@ t _ b a t c h _ m o d e _ t r a n s f o r m ()
def forward ( self , X : Tensor ) -> Tensor :
po st er io r = self . model . po st eri or ( X )
samples = self . sampler ( p os te rio r )
obj = self . ob je ct iv e ( samples )
mean = obj . mean ( dim =0)
z = mean + self . b e t a _ p r i m e * ( obj - mean ) . abs ()
return z . max ( dim = -1) . values . mean ( dim =0)
Code Example 4: Generalized Parallel UCB
forq = 1 andq = 3, KG-CF reaches lower regret signiﬁcantly faster forq = 1 compared toq = 3,
suggesting that “looking ahead“ is beneﬁcial in this context.
H.2 Generalized UCB
Code Example 4 presents a generalized version of parallel UCB from Wilson et al. [97] supporting
pending candidates, generic objectives, and QMC sampling. If no sampler is speciﬁed, a default
QMC sampler is used. Similarly, if no objective is speciﬁed, the identity objective is assumed.
H.3 Full Code Examples
In this section we provide full implementations for the code examples. Speciﬁcally, we include
parallel Noisy EI (Code Example 5), OKG (Code Example 6), and (negative) Integrated Posterior
Variance (Code Example 7).
31

class q N o i s y E x p e c t e d I m p r o v e m e n t ( M C A c q u i s i t i o n F u n c t i o n ) :
def __init__ (
self ,
model : Model ,
X _ b a s e l i n e : Tensor ,
sampler : Optional [ MC Sam pl er ] = None ,
ob je ct iv e : Optional [ M C A c q u i s i t i o n O b j e c t i v e ] = None ,
X_ pe nd in g : Optional [ Tensor ] = None ,
) -> None :
super () . __init__ ( model , sampler , objective , X_ pen di ng )
self . r e g i s t e r _ b u f f e r ( " X _ b a s e l i n e " , X _ b a s e l i n e )
@ c o n c a t e n a t e _ p e n d i n g _ p o i n t s
@ t _ b a t c h _ m o d e _ t r a n s f o r m ()
def forward ( self , X : Tensor ) -> Tensor :
q = X . shape [ -2]
X_bl = m a t c h _ s h a p e ( self . X_baseline , X )
X_full = torch . cat ([ X , X_bl ] , dim = -2)
po st er io r = self . model . po st eri or ( X_full )
samples = self . sampler ( p os te rio r )
obj = self . ob je ct iv e ( samples )
obj_n = obj [... ,: q ]. max ( dim = -1) . values
obj_p = obj [... , q :]. max ( dim = -1) . values
return ( obj_n - obj_p ) . c lam p_ mi n (0) . mean ( dim =0)
Code Example 5: Parallel Noisy EI (full)
32

class q K n o w l e d g e G r a d i e n t ( M C A c q u i s i t i o n F u n c t i o n ) :
def __init__ (
self ,
model : Model ,
sampler : MCSampler ,
ob je ct iv e : Optional [ Ob je ct iv e ] = None ,
i n n e r _ s a m p l e r : Optional [ MC Sa mpl er ] = None ,
X_ pe nd in g : Optional [ Tensor ] = None ,
) -> None :
super () . __init__ ( model , sampler , objective , X_ pen di ng )
self . i n n e r _ s a m p l e r = i n n e r _ s a m p l e r
def forward ( self , X : Tensor ) -> Tensor :
splits = [ X . size ( -2) - self . Nf , self . N_f ]
X , X _ f a n t a s i e s = torch . split (X , splits , dim = -2)
# [...] some re - shaping for batch e v a l u a t i o n purposes
if self . X_ pe nd in g is not None :
X_p = m a t c h _ s h a p e ( self . X_pending , X )
X = torch . cat ([ X , X_p ] , dim = -2)
fmodel = self . model . f an ta siz e (
X =X ,
sampler = self . sampler ,
o b s e r v a t i o n _ n o i s e = True ,
)
obj = self . ob je ct iv e
if i s i n s t a n c e ( obj , M C A c q u i s i t i o n O b j e c t i v e ) :
i n n e r _ a c q f = S i m p l e R e g r e t (
fmodel , sample = self . inner_sampler , ob je ct ive = obj ,
)
else :
i n n e r _ a c q f = P o s t e r i o r M e a n ( fmodel , ob je ct iv e = obj )
with settings . p r o p a g a t e _ g r a d s ( True ) :
values = i n n e r _ a c q f ( X _ f a n t a s i e s )
return values . mean ( dim =0)
Code Example 6: One-Shot Knowledge Gradient (full)
33

class q N e g I n t e g r a t e d P o s t e r i o r V a r i a n c e ( A n a l y t i c A c q u i s i t i o n F u n c t i o n ) :
def __init__ (
self ,
model : Model ,
mc _p oi nt s : Tensor ,
X_ pe nd in g : Optional [ Tensor ] = None ,
) -> None :
super () . __init__ ( model = model )
self . _ d u m m y _ s a m p l e r = I I D N o r m a l S a m p l e r (1)
self . X _p en din g = X _p en di ng
self . r e g i s t e r _ b u f f e r ( " m c_ po in ts " , mc _p oin ts )
@ c o n c a t e n a t e _ p e n d i n g _ p o i n t s
@ t _ b a t c h _ m o d e _ t r a n s f o r m ()
def forward ( self , X : Tensor ) -> Tensor :
f a n t _ m o d e l = self . model . fa nta si ze (
X =X ,
sampler = self . _dummy_sampler ,
o b s e r v a t i o n _ n o i s e = True ,
)
b a t c h _ o n e s = [1] * len ( X . shape [: -2])
mc _p oi nt s = self . mc _p oi nt s . view (* batch_ones , -1 , X . size ( -1) )
with settings . p r o p a g a t e _ g r a d s ( True ) :
po st er io r = f a n t _ m o d e l . po st eri or ( m c_ poi nt s )
ivar = po st er io r . variance . mean ( dim = -2)
return - ivar . view ( X . shape [: -2])
Code Example 7: Active Learning (full)
34