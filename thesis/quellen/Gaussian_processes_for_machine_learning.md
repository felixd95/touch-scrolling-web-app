# Gaussian_processes_for_machine_learning

Quelle: C:\Users\Felix\Desktop\Master\Thesis\Quellen\ML\Gaussian_processes_for_machine_learning.pdf

---
Journal of Machine Learning Research 11 (2010) 3011-3015 Su bmitted 8/10; Revised 9/10; Published 11/10
Gaussian Processes for Machine Learning (GPML) Toolbox
Carl Edward Rasmussen∗ CER 54@ CAM .AC.UK
Department of Engineering
University of Cambridge
Trumpington Street
Cambridge, CB2 1PZ, UK
Hannes Nickisch HN@TUE .MPG .DE
Max Planck Institute for Biological Cybernetics
Spemannstraße 38
72076 T¨ubingen, Germany
Editor: S¨oren Sonnenburg
Abstract
The GPML toolbox provides a wide range of functionality for G aussian process (GP) inference
and prediction. GPs are speciﬁed by mean and covariance func tions; we offer a library of simple
mean and covariance functions and mechanisms to compose mor e complex ones. Several likeli-
hood functions are supported including Gaussian and heavy- tailed for regression as well as others
suitable for classiﬁcation. Finally, a range of inference m ethods is provided, including exact and
variational inference, Expectation Propagation, and Lapl ace’s method dealing with non-Gaussian
likelihoods and FITC for dealing with large regression tasks.
Keywords: Gaussian processes, nonparametric Bayes, probabilistic regression and classiﬁcation
Gaussian processes (GPs) (Rasmussen and Williams, 2006) have convenient properties for many
modelling tasks in machine learning and statistics. They can be used to specify distr ibutions over
functions without having to commit to a speciﬁc functional form. Applications range f rom regres-
sion over classiﬁcation to reinforcement learning, spatial models, survival and other time series 1
models. Predictions of GP models come with a natural conﬁdence measure: predic tive error-bars.
Although the implementation of the basic principles in the simplest case is straight forw ard,
various complicating features are often desired in practice. For example, a GP is determined by a
mean function and a covariance function, but these functions are mostly difﬁcult to specify fully a
priori, and typically they are given in terms of hyperparameters, that is, parameters which have to
be inferred. Another source of difﬁculty is the likelihood function. For Gaussian likelihoods, in-
ference is analytically tractable; however, in many tasks, Gaussian likelihood s are not appropriate,
and approximate inference methods such as Expectation Propagation (EP) (Minka, 2001), Laplace’s
approximation (LA) (Williams and Barber, 1998) and variational bounds (VB)(Gibbs and MacKay,
2000) become necessary (Nickisch and Rasmussen, 2008). In case of large training data, approxi-
mations (Candela and Rasmussen, 2005) like FITC (Snelson and Ghahramani, 2006) are needed.
The GPML toolbox is designed to overcome these hurdles with its variety of mean , covariance
and likelihood functions as well as inference methods, while being simple to use and easy to extend.
∗. Also at Max Planck Institute for Biological Cybernetics, Spemannstraße 38, 72076 T¨ubingen, Germany.
1. Note, that here we typically think of GPs with a more general index set than time.
©2010 Carl Edward Rasmussen and Hannes Nickisch.

RASMUSSEN AND NICKISCH
1. Implementation
The GPML toolbox can be obtained from http://gaussianprocess.org/gpml/code/matlab/
and alsohttp://mloss.org/software/view/263/ under the FreeBSD license. Based on simple
interfaces for covariance, mean, likelihood functions as well as inference me thods, we offer full
compatibility to both Matlab 7.x 2 and GNU Octave 3.2.x. 3 Special attention has been given to
properly disentangle covariance, likelihood and mean hyperparameters. Also, care has been taken to
avoid numerical inaccuracies, for example, safe likelihood evaluations for extreme inputs and stable
matrix operations. For example, the covariance matrix K can become numerically close to singular
making its naive inversion numerically unsafe. We handle these situations in a prin cipled way 4
such that Cholesky decompositions are computed of well-conditioned matrices only. As a result,
our code shows a high level of robustness along the full spectrum of po ssible hyperparameters.
The focus of the toolbox is on approximate inference using dense matrix alge bra. We currently
do not support covariance matrix approximation techniques to deal with large numbers of training
examples n. Looking at the (growing) body of literature on sparse approximations, this knowledge
is still somewhat in ﬂux, and consensus on the best approaches has not yet been reached.
We provide stable and modular code checked by an exhaustive suite of test cases. A single
functiongp.m serves as main interface to the user—it can make inference and predictions and allows
the mean, covariance and likelihood function as well as the inference methods to bespeciﬁed freely.
Furthermore, gp.m enables convenient learning of the hyperparameters by maximising the log
marginal likelihood ln Z. One of the particularly appealing properties of GP models is that princi-
pled and practical approaches exist for learning the parameters of mean , covariance and likelihood
functions. Good adaptation of such parameters can be essential to obtain both high quality pre-
dictions and insights into the properties of the data. The GPML toolbox is particula rly ﬂexible,
including a large library of different covariance and mean functions, and ﬂ exible ways to combine
these into more expressive, specialised functions. The user can choose between two gradient-based
optimisers: one uses conjugate gradients (CG)5 and the other one relies on a quasi-Newton scheme.6
Computing the derivatives w.r.t. hyperparameters ∂
∂θi
lnZ with gp.m does not need any extra pro-
gramming effort; every inference method automatically collects the respective derivatives from the
mean, covariance and likelihood functions and passes them togp.m.
Our documentation comes in two pieces: a hypertext user documentation 7 doc/index.html
with examples and code browsing and a technical documentation 8 doc/manual.pdf focusing on
the interfaces and more technical issues. A casual user will use the hyperte xt document to quickly
get his data analysed, however a power user will consult the pdf document once he wants to include
his own mean, covariance, likelihood and inference routines or learn about implementation details.
2. Matlab is available from MathWorks,http://www.mathworks.com/.
3. Octave is available from the Free Software Foundation,http://www.gnu.org/software/octave/.
4. We do not consider the “blind” addition of a “small ridge” toK a principled way.
5. Carl Rasmussen’s code is available athttp://www.kyb.tuebingen.mpg.de/bs/people/carl/code/minimize/.
6. Peter Carbonetto’s wrapper can be found athttp://www.cs.ubc.ca/˜pcarbo/lbfgsb-for-matlab.html .
7. Documentation can be found at http://www.gaussianprocess.org/gpml/code/matlab/doc/index.html.
8. Technical docs are available athttp://www.gaussianprocess.org/gpml/code/matlab/doc/manual.pdf.
3012

GAUSSIAN PROCESSES FOR MACHINE LEARNING TOOLBOX
2. The GPML Toolbox
We illustrate the modular structure of the GPML toolbox by means of a simple code exa mple.
GPs are used to formalise and update knowledge about distributions over fu nctions. A GP prior
distribution on an unknown latent function f ∼ GP (mφ(x),kψ(x,x′)), consists of a mean func-
tion m(x) = E[ f (x)], and a covariance function k(x,x) = E[( f (x) − m(x))( f (x′) − m(x′))], both of
which typically contain hyperparameters φ andψ, which we want to ﬁt in the light of data. We
generally assume independent observations, that is, input/output pairs (xi,yi) of f with joint likeli-
hood Pρ(y|f) = ∏ n
i=1 Pρ(yi| f (xi)) factorising over cases. Finally, after speciﬁcation of the prior and
ﬁtting of the hyperparameters θ = {φ,ψ,ρ}, we wish to compute predictive distributions for test
cases.
% 1) SET UP THE GP: COVARIANCE; MEAN, LIKELIHOOD, INFERENCE M ETHOD
1 mf = { ’meanSum’ ,{’meanLinear’ ,@meanConst}}; a = 2; b = 1; % m(x) = a*x+b
2 cf = { ’covSEiso’ }; sf = 1; ell = 0.7; % squared exponential covariance funct
3 lf = ’likLaplace’ ; sn = 0.2; % assume Laplace noise with variance snˆ2
4 hyp0. mean = [a;b]; hyp0. cov = log([ell;sf]); hyp0. lik = log(sn); % hypers
5 inf = ’infEP’ ; % specify expectation propagation as inference method
% 2) MINIMISE NEGATIVE LOG MARGINAL LIKELIHOOD nlZ wrt. hyp; do 50 CG steps
6 Ncg = 50; [ hyp , nlZ] = minimize(hyp0, ’gp’ , -Ncg, inf , mf, cf, lf, X, y);
% 3) PREDICT AT UNKNOWN TEST INPUTS
7 [ymu, ys2] = gp(hyp , inf , mf, cf, lf, X, y, Xs); % test input Xs
In line 1, we specify the mean mφ(x) = a⊤x + b of the GP with hyperparameters φ = {a,b}.
First, the functional form of the mean function is given and its parameters are in itialised. The
desired mean function, happens not to exist in the library of mean functions; ins tead we have to
make a composite mean function from simple constituents. This is done using a nested cell array
containing the algebraic expression for m(x): As the sum of a linear ( mean/meanLinear.m) and
a constant mean function ( mean/meanConst.m) it is an afﬁne function. In addition to linear and
constant mean functions, the toolbox offers m(x) = 0 and m(x) = 1. These simple mean functions
can be combined bycomposite mean functions to obtain sums (mean/meanSum.m) m(x) = ∑ j m j(x),
products m(x) = ∏ j m j(x), scaled versionsm(x) = α m0(x) and powersm(x) = m0(x)d. This ﬂexible
mechanism is used for convenient speciﬁcation of an extensible algebra of mean functions. Note
that functions are referred to either as name strings ’meanConst’ or alternatively function handles
@meanConst. The order of components of the hyperparametersφ is the same as in the speciﬁcation
of the cell array. Every mean function implements its evaluation m = mφ(X) and ﬁrst derivative
computation mi = ∂
∂φi
mφ(X) on a data set X.
In the same spirit, the squared exponential covariance kψ(x,x′) = σ f ²exp(− ‖x − x′‖2 /2ℓ2)
(cov/covSEiso.m) with hyperparameters ψ = {ln ℓ,lnσ f } is set up in line 2. Note, that the hy-
perparameters are represented by the logarithms, as these parameters are naturally positive. Many
other simple covariance functions are contained in the toolbox. Among others, we offer linea r,
constant, Mat ´ern, rational quadratic, polynomial, periodic, neural network and ﬁnite su pport co-
variance functions. Composite covariance functions allow for sums k(x,x′) = ∑ j k j(x,x′), prod-
ucts k(x,x′) = ∏ j k j(x,x′), positive scaling k(x,x′) = σ 2
f k0(x,x′) and masking of components
k(x,x′) = k0(xI,x′
I) with I ⊆ [1,2, ..,D], x ∈ RD. Again, the interface is simple since only the
evaluation of the covariance matrix K = kψ(X) and its derivatives ∂iK = ∂
∂ψ i
kψ(X) on a data set
X are required. Furthermore, we need cross terms k∗ = kψ(X,x∗) and k∗∗ = kψ(x∗,x∗) for pre-
diction. There are no restrictions on the composition of both mean and covariance f unctions—any
combination is allowed including nested composition.
3013

RASMUSSEN AND NICKISCH
The Laplace (lik/likLaplace.m) likelihood Pρ(y| f ) = exp(−
√
2/σ n|y − f |)/
√
2σ n with hy-
perparametersρ = {lnσ n} is speciﬁed in line 3. There are only simple likelihood functions: Gaus-
sian, Sech-squared, Laplacian and Student’s t for ordinary and sparse regression as well as the error
and the logistic function for classiﬁcation. Again, the same inference code is used for any likelihood
function. Although the speciﬁcation of likelihood functions is simple for the user, writing new like-
lihood functions is slightly more involved as different inference methods require access to different
properties; for example, LA requires second derivatives and EP requires derivatives of moments.
All hyperparametersθ = {φ,ψ,ρ} are stored in a struct hyp.{mean,cov,lik}, which is ini-
tialised in line 4; we select the approximate inference algorithm EP (inf/infEP.m) in line 5.
We optimise the hyperparameters θ ≡hyp by calling the CG optimiser ( util/minimize.m)
with initial valueθ0 ≡hyp0 in line 6 allowing at most N = 50 evaluations of the EP approximation
to the marginal likelihood ZEP(θ) as done by gp.m. Here, D = (X,y) ≡(X,y) is the training
data where X = {x1, ..,xn} and y ∈ Rn. Under the hood, gp.m computes in every step a Gaussian
posterior approximation and the derivatives ∂
∂θ lnZEP(θ) of the marginal likelihood by calling EP.
Predictions with optimised hyperparameters are done in line 7, where we call gp.m with the
unseen test inputs X∗ ≡Xs as additional argument. As a result, we obtain the approximate marginal
predictive mean E[P(y∗|D,X∗)] ≡ymu and the predictive variance V[P(y∗|D,X∗)] ≡ys2.
Likelihood \ Inference Exact FITC EP Laplace VB Type, Output Domain Alternate Name
Gaussian ✓ ✓ ✓ ✓ ✓ regression, R
Sech-squared ✓ ✓ ✓ regression, R logistic distribution
Laplacian ✓ ✓ regression, R double exponential
Student’s t ✓ ✓ regression, R
Error function ✓ ✓ ✓ classiﬁcation, {±1} probit regression
Logistic function ✓ ✓ ✓ classiﬁcation, {±1} logit regression
Table 1: Likelihood ↔ inference compatibility in the GPML toolbox
Table 1 gives the legal likelihood/inference combinations. Exact inference and the FITC approx-
imation support the Gaussian likelihood only. Variational Bayesian (VB) inference is applicable to
all likelihoods. Expectation propagation (EP) for the Student’s t likelihood is inheren tly unstable
due to its non-log-concavity. The Laplace approximation (LA) for Laplace likelihoods is not sensi-
ble due to the non-differentiable peak of the Laplace likelihood. Special care has been taken for the
non-convex optimisation problem imposed by the combination Student’s t likelihood andLA.
If the number of training examples is larger than a few thousand, dense matrix computations be-
come too slow. We provide the FITC approximation for regression with Gaussian likelihood where
instead of the exact covariance matrix K, a low-rank plus diagonal matrix ˜K = Q + diag(K − Q)
where Q = K⊤
u K−1
uu Ku is used. The matrices Kuu and Ku contain covariances and cross-covariances
of and between inducing inputs ui and data points x j. Using inf/infFITC.m together with any co-
variance function wrapped intocov/covFITC.m makes the computations feasible for large n.
Acknowledgments
Thanks to Ed Snelson for assisting with the FITC approximation.
3014

GAUSSIAN PROCESSES FOR MACHINE LEARNING TOOLBOX
References
Joaquin Qui˜nonero Candela and Carl E. Rasmussen. A unifying view of sparse appr oximate Gaus-
sian process regression. Journal of Machine Learning Research, 6(6):1935–1959, 2005.
Mark N. Gibbs and David J. C. MacKay. Variational Gaussian process cla ssiﬁers. IEEE Transac-
tions on Neural Networks, 11(6):1458–1464, 2000.
Thomas P. Minka. Expectation propagation for approximate Bayesian inferen ce. In UAI, pages
362–369. Morgan Kaufmann, 2001.
Hannes Nickisch and Carl E. Rasmussen. Approximations for binary Gaussia n process classiﬁca-
tion. Journal of Machine Learning Research, 9:2035–2078, 10 2008.
Carl E. Rasmussen and Christopher K. I. Williams.Gaussian Processes for Machine Learning. The
MIT Press, Cambridge, MA, 2006.
Ed Snelson and Zoubin Ghahramani. Sparse Gaussian processes using pseudo-inputs. In Advances
in Neural Information Processing Systems 18, 2006.
Christopher K. I. Williams and D. Barber. Bayesian classiﬁcation with Gaussia n processes. IEEE
Transactions on Pattern Analysis and Machine Intelligence, 12(20):1342–1351, 1998.
3015