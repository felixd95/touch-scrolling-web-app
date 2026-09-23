# TFTuneCreationAndPersonalizationOfPointingTransferFunctionsUsingReinforcementLearning

Quelle: C:\Users\Felix\Desktop\Master\Thesis\Quellen\HCI\TFTuneCreationAndPersonalizationOfPointingTransferFunctionsUsingReinforcementLearning.pdf

---
TFTune: Creation and Personalization of Pointing Transfer 
Functions Using Reinforcement Learning 
Ethan Eddy 
Department of Electrical and 
Computer Engineering 
University of New Brunswick 
Fredericton, New Brunswick, Canada 
eeddy@unb.ca 
Evan Campbell 
Department of Electrical and 
Computer Engineering 
University of New Brunswick 
Fredericton, New Brunswick, Canada 
evan.campbell1@unb.ca 
Erik J Scheme 
Department of Electrical and 
Computer Engineering 
University of New Brunswick 
Fredericton, New Brunswick, Canada 
escheme@unb.ca 
Scott Bateman 
Faculty of Computer Science 
University of New Brunswick 
Fredericton, New Brunswick, Canada 
scottb@unb.ca 
Géry Casiez 
Univ. Lille, CNRS, Inria, Centrale Lille, 
UMR 9189 CRIStAL 
Lille, France 
gery.casiez@univ-lille.fr 
Figure 1: TFTune is a reinforcement-learning approach for automatically tuning pointing transfer functions. It was evaluated 
in three settings: (A) creating functions for a MacBook trackpad; (B) personalizing default functions on Windows PCs with a 
mouse; and (C) mapping contraction intensity to cursor speed for a muscle-computer interface. (D) Shows an example transfer 
function evolving over iterations (top) and its corresponding reward trajectory (bottom). 
Abstract 
Pointing transfer functions define the mapping between input de-
vices and onscreen cursor movement. Despite being used by mil-
lions daily, only marginal improvements in pointing performance 
have been achieved by tuning transfer functions since the intro-
duction of acceleration-based gains. We present TFTune, a rein-
forcement learning-based approach for improving pointing by au-
tomatically tuning personalized transfer functions. We show that 
TFTune-generated functions outperform operating system defaults, 
improving movement times by 7% on macOS when using a trackpad 
(7 minutes of tuning) and 8% on participants’ personal Windows 
This work is licensed under a Creative Commons Attribution-NonCommercial-
NoDerivatives 4.0 International License. 
CHI ’26, Barcelona, Spain 
© 2026 Copyright held by the owner/author(s). 
ACM ISBN 979-8-4007-2278-3/26/04 
https://doi.org/10.1145/3772318.3790291 
computers with hardware (i.e. mice and monitors) of varying char-
acteristics (after just 1 minute of tuning). Further, we show that 
TFTune generalizes beyond traditional pointing devices, providing 
16% improvement for a muscle-computer interface (2 minutes of 
tuning). TFTune demonstrates an initial approach for scalable and 
meaningful performance improvements in input–output mappings, 
opening a new direction for exploring the use of machine learning 
for improving fundamental computer inputs. 
CCS Concepts 
• Human-centered computing → Pointing; • Computing method-
ologies → Reinforcement learning. 
Keywords 
Customization, Personalization, Pointing, Reinforcement Learning, 
Transfer Function 
ACM Reference Format: 
Ethan Eddy, Evan Campbell, Erik J Scheme, Scott Bateman, and Géry Casiez. 
2026. TFTune: Creation and Personalization of Pointing Transfer Functions 

CHI ’26, April 13–17, 2026, Barcelona, Spain Eddy et al. 
Using Reinforcement Learning. In Proceedings of the 2026 CHI Conference on 
Human Factors in Computing Systems (CHI ’26), April 13–17, 2026, Barcelona, 
Spain. ACM, New York, NY, USA, 13 pages. https://doi.org/10.1145/3772318. 
3790291 
1 Introduction 
When using a pointing device, like a mouse or trackpad, onscreen 
cursor movement is governed by a transfer function—the mapping 
between physical movement registered by the input device and the 
displacement of a cursor in the display space [21]. Typically, this 
mapping is defined by a non-linear function that dynamically sets 
the control gain (i.e. the multiplier applied to the cursor speed) [10]. 
Because pointing remains a fundamental and frequent interaction 
for computer systems, even minor improvements in transfer func-
tions can substantially impact productivity. For example, although 
the performance difference between acceleration-based gains and 
constant gains was found to be only about 5.5% in lab-based stud-
ies, the improvement was considered important enough to be used 
in every major operating system [10]. Since the advent of these 
approaches, however, no work (to the best of our knowledge) has 
shown how transfer functions can be tuned, even through personal-
ization, to achieve meaningful performance differences. If a method 
could provide improvements (on par with the transition from con-
stant to acceleration-based gains), it would mark a significant step 
forward in the state-of-the-art for pointing interactions. 
Although the pointing transfer functions used in operating sys-
tems have been reverse-engineered and are publicly available [9], 
the exact methodology behind their creation is unknown. This 
makes tuning transfer functions (i.e. creating them for new interac-
tive systems and modifying pre-established functions to improve 
performance or usability) difficult [35]. While several approaches 
have been identified for tuning (including drawing the transfer 
function by hand or adjusting the parameters of a mathematical 
equation [46]), they typically require time and expertise to create 
mappings that perform reasonably well; and, are likely not some-
thing that end-users could or would do on their own. As such, 
users are given little control over their transfer functions in system 
settings, often being limited to simple multipliers on a global trans-
fer function (e.g. the “speed slider” in Windows) [9]. This means 
that opportunities for personalization—an important aspect in the 
design of accessible and usable interactive systems—have histori-
cally been limited. Ideally, there would be a simple approach that 
could automatically tune and improve transfer functions without 
requiring an experienced system designer, manual intervention, or 
a time-consuming calibration process. 
To address the lack of support for improving pointing perfor-
mance through personalized transfer function tuning, we introduce 
TFTune, a reinforcement-learning-based solution for automatically 
tuning transfer functions. We evaluate TFTune in three pointing-
based studies: (1) creating functions on macOS from scratch for 
a trackpad, (2) personalizing a pre-established function on Win-
dows for a mouse, and (3) creating mappings for a muscle-computer 
interface (MCI). The results show that TFTune outperforms all non-
personalized baselines in ∼7 minutes, ∼1 minute, and ∼2 minutes 
in experiments 1, 2, and 3, respectively. Additionally, we demon-
strate TFTune’s ability to scale to real-world conditions: it functions 
reliably across diverse hardware, and participants reported no per-
ceived degradation after 2–4 weeks of at-home use. TFTune was 
also shown to generalize beyond conventional pointing devices, 
improving performance for a 1D rate controlled MCI task. Our work 
not only demonstrates the first approach for improving pointing 
transfer functions since acceleration-based gains, but also intro-
duces a scalable solution that extends to a wide range of pointing 
devices. In doing so, we demonstrate a promising future direction 
for advancing the fundamental pointing interactions used by mil-
lions of people every day. 
2 Related Work 
2.1
 Pointing and Transfer Functions 
Transfer functions convert input from a user (e.g. the registered 
relative displacement of a mouse) into output (e.g. the speed of a 
cursor on a screen) [21]. For desktop-based pointing, displacement 
is measured by a mouse using an optical flow sensor or a touchpad 
through a set of capacitive sensors and reported by the device as 
the number of counts in the 𝑑𝑥 and 𝑑𝑦 directions. These counts are 
directly influenced by hardware specifications, including the device 
resolution (the number of counts per inch, or CPI) and polling rate 
(the report rate per second, typically between 125 and 1000 Hz) 
[21, 27]. Once reported by a device, these raw counts are passed to 
the system (e.g. the Windows operating system), which maps them 
to a displacement (in pixels) of the cursor in the display space. 
The simplest technique to map counts to pixel displacement is to 
apply a constant control-display (CD) gain (or multiplier) between 
input and output. A constant CD gain assumes a linear mapping 
between input and output speeds (expressed using the same phys-
ical units). In contrast, non-linear transfer functions dynamically 
adjust the CD gain depending on the input velocity. Based on the 
hybrid optimized impulse motor control model [34], these transfer 
functions typically use high CD gains during the ballistic phase 
of the pointing movement, corresponding to high velocities (to 
quickly cover the distance to the target), and low CD gains dur-
ing the corrective phase, corresponding to low velocities (to more 
precisely select targets). Non-linear functions have been shown to 
outperform constant gains by up to 5.5%, which explains why all 
major operating systems (e.g. Windows, macOS, and Linux) use 
non-linear mappings, some of which have been reverse-engineered 
and are publicly available within the open-source libpointing 
library [9]. However, little information exists about the methodol-
ogy used to create these functions, and thus, their improvement 
and evolution have been limited. For this reason, most research on 
facilitating and improving pointing has used pointing assistance 
techniques that do not change the underlying transfer function, but 
instead manipulate the distance to or width of targets to facilitate 
target acquisition [5, 6, 13, 33, 38]. While these approaches can 
improve pointing performance, they rely on additional information 
or context that is often unavailable and, therefore, do not scale to 
the wide range of interactions encountered in everyday pointing. 
2.2 Transfer Function Tuning 
Tuning refers to creating or modifying a transfer function to pro-
vide the best performance and/or to behave in a way desirable to a 
user. There are two main types of tuning: (1) creation from scratch 

TFTune: Creation and Personalization of Pointing Transfer Functions Using Reinforcement Learning CHI ’26, April 13–17, 2026, Barcelona, Spain 
and (2) modification of pre-established functions. In both cases, if 
these are done per user, they are forms of personalization. Creating 
(1) a transfer function is typically done for novel inputs or interac-
tion techniques, whereby a previously established transfer function 
does not exist. This typically involves manually changing points 
on a curve or tuning a mathematical formula (e.g. the slope of a 
line) [46]. For example, Nancel et al. manually adjusted parameters 
through pilot studies to optimize pointing on large displays [35]. 
Similarly, Antoine et al. iteratively tuned a sigmoid-parabolic curve, 
incorporating a dead band to enable scrolling with a pressure sensor 
[3]. Modification (2) involves optimizing a pre-established transfer 
function (e.g. the Windows or macOS function) for a particular user, 
whether for preference, performance, or accessibility. Due to the 
expertise required to create and modify transfer functions directly, 
personalization for pointing has typically been achieved with a 
simple slider, limiting the potential performance improvements 
that could arise from discovering new mapping characteristics. Be-
cause it is difficult to achieve meaningful benefits from modifying or 
personalizing these functions, prior work has largely focused on cre-
ating new functions from scratch. Such approaches have provided 
comparable performance, but have not exceeded the performance 
of pre-established mappings [30]. While such approaches advance 
transfer function creation, they provide no means of improving 
upon pre-established, well-performing mappings. 
2.3 Human-in-the-Loop Optimization and 
Reinforcement Learning 
Human-in-the-loop (HITL) optimization broadly refers to tech-
niques where a system adapts parameters that affect performance 
in collaboration with the end user, thus leveraging interaction as 
feedback to improve personalization and performance [42]. For 
instance, Chan et al. used Bayesian optimization to personalize 
transfer functions for a 3D pointing task by suggesting parameter 
adjustments to designers [11]. While effective in lowering work-
load, their approach produced functions that were outperformed 
by non-automated designs and reduced users’ sense of agency. 
Similarly, Liao et al. showed they can use similar approaches to 
accelerate personalization in diverse contexts such as text entry 
[32] and wrist-based pointing [31]. HITL optimization has also 
been applied in domains such as hand gesture recognition, where 
machine learning models are adapted using data collected from 
users during real-time interactions [8, 12]. Within desktop pointing 
specifically, AutoGain exemplifies a heuristic optimization method 
where it incrementally adjusts transfer function speed bins via sub-
movement decomposition, increasing or decreasing gains based 
on overshoots and undershoots [30]. Like many HITL approaches, 
AutoGain is limited by lengthy calibration times (∼30 minutes) and 
was not able to improve upon existing OS transfer functions. 
Reinforcement learning (RL) is a framework for optimizing agents 
through interactions with an environment, where reward signals 
incrementally shape policies toward improved performance [23]. 
When applied to optimize interactions between a human and com-
puter, RL can be viewed as a technique for enabling human-in-the-
loop optimization, as the system continuously adapts based on user 
input. Modern RL algorithms are typically classified as off-policy, 
which can learn from data generated by other policies (e.g. previ-
ously played games), or on-policy, which learn from data generated 
by the policy being optimized (e.g. repeatedly attempting to walk 
and improving through trial and error). Within this categorization, 
many approaches exist, including policy-gradient networks [43], 
actor-critic methods [19], and Q-learning [45]. Combined with re-
cent advancements in deep learning, RL has led to many notable 
advancements in HCI, such as solving complex games, supporting 
recommendation systems, optimizing large language models, and 
modelling human behaviours [1, 7, 20, 29, 36, 41, 44]. Based on 
these previous successes, we hypothesize that RL is a promising 
approach for automatically tuning personalized transfer functions 
for pointing. 
3 Implementation 
This section formalizes the TFTune approach as a reinforcement 
learning (RL) problem and describes how the RL policy is trained 
and eventually converted into a deployable transfer function. 
3.1 Formulating Transfer Function Tuning as 
an RL Problem 
We model TFTune as a Markov Decision Process (MDP) where 
the agent follows a policy 𝜋𝜃 to select actions (gain values) and 
the environment comprises everything external to the agent (the 
user, the input device, and the pointing application). In the MDP 
framework, the environment emits a state 𝑠𝑡 , the agent selects an 
action, 𝑎𝑡 , and the environment returns the next state 𝑠𝑡 +1 and 
reward 𝑟𝑡 according to the transition dynamics 𝑇 . The policy 𝜋𝜃 is 
parameterized by 𝜃 , which, following policy gradient approaches, 
produces a mean estimate for the action 𝜇𝜃 (𝑠𝑡 ) = 𝜋𝜃 (𝑠𝑡 ), which 
is either taken deterministically as the action for inference (𝑎𝑡 = 
𝜇𝜃 (𝑠𝑡 )) or used via sampling for training (𝑎𝑡 = 𝜇𝜃 (𝑠𝑡 ) + 𝜎 ⊙ 𝜖; 𝜖 ∼ 
N (0, 𝐼 )) with sampling standard deviation 𝜎 learned alongside the 
training process. In TFTune, this policy is implemented by a neural 
network with a single output neuron, which, after training, serves 
as the learned transfer function. The goal of this RL problem was 
to learn the policy that maps the current device input state 𝑠𝑡 to 
a continuous gain 𝑎𝑡 , such that the resulting sequence of actions 
maximizes the cumulative reward defined in our MDP. In other 
words, TFTune searches for the policy parameters 𝜃 that produce 
gain values leading to improved pointing performance. 
𝑀 = (𝑠, 𝑎, 𝑇 , 𝑟 , 𝛾 ) 
• State (𝑠𝑡 ∈ R𝑁 ). A scalar representing the magnitude of 
input counts 𝑑vec = 
√︃
𝑑2 𝑥+ 𝑑2 𝑦. The rate at which new states 
get generated is governed by the polling rate of the device. 
• Action (𝑎𝑡 ∈ R𝑀 ). The gain value produced by the pol-
icy network, specifying the multiplier (as a floating point 
number) to be applied to 𝑑𝑥 and 𝑑𝑦 . 
• Transition dynamics (𝑇 ). The agent influences transitions 
only through the gain it applies, which alters the cursor 
displacement the user responds to. 
• Reward (¯𝑟 ). The reward function combines terminal through-
put bonuses with shaping terms for progress toward the 
target: 

CHI ’26, April 13–17, 2026, Barcelona, Spain Eddy et al. 
𝑟𝑡 = 
  
  
TP, if terminated and in target, 
TP 
 
1 − |𝑑0 − 𝑑𝑡 | 
𝑑0 
 
, if terminated and not in target, 
−0.1, if 𝑑𝑡 = 𝑑𝑡 −1 and not in target, 
0.1, if in target, 
𝑑𝑡 −1 − 𝑑𝑡 
𝑑0 
, otherwise. 
(1) 
where 𝑑𝑡 = dist(cursor, target) at time 𝑡 and TP is the 
throughput for the completed trial. 
• Discount factor (𝛾 ). We use 𝛾 = 0.99, following standard 
PPO implementations. 
3.2 Proximal Policy Optimization (PPO) 
To optimize the policy (i.e. transfer function), we used Proximal 
Policy Optimization (PPO), an on-policy actor–critic algorithm that 
iteratively improves 𝜋𝜃 as the agent interacts with the environment. 
PPO was selected for its robustness and training stability, achieved 
through a trust-region–like update mechanism that prevents overly 
large or destructive policy updates [40]. For reproducibility, we 
used the stable-baselines3 implementation of PPO [37]. 
3.3 Transfer Function Extraction 
After training, the policy (𝜋𝜃 ) can be deployed in two ways. If 
the network is sufficiently lightweight, it can run directly at the 
device’s polling rate (e.g. the policy in Experiment 2 achieved a 
CPU inference time of 0.22 ms). Alternatively, the policy can be 
converted into a discrete transfer function by sampling 𝜋𝜃 over 
the input space and storing the resulting gains in a lookup table of 
length 𝑁 , with linear interpolation between entries. This removes 
runtime inference and yields a fully interpretable function. In our 
studies, we used the network outputs directly in Experiment 1; a 
128-entry table (matching the 8-bit range of most pointing devices) 
in Experiment 2; and a 20-entry table for the reduced EMG input 
range in Experiment 3. In all cases, extraction time (from neural 
network to array) took less than one second. 
3.4 TFTune Summary 
For each device polling event, the environment (described above) 
emits a state 𝑠𝑡 representing the instantaneous movement mag-
nitude 𝑑vec. The actor network implements a policy 𝜋𝜃 , which 
defines a distribution over gain values given the current state. At 
each timestep, the gain action is sampled from the policy (either 
stochastically during training or deterministically during deploy-
ment) and applied to scale the raw device counts (𝑑𝑥 , 𝑑𝑦 ) before 
updating the cursor coordinates. This updated cursor is rendered 
to the user when the screen is refreshed, influencing the user’s 
subsequent motor response and thereby shaping the environment 
dynamics. The environment then computes a reward 𝑟𝑡 compris-
ing dense shaping terms for reducing cursor-target distance and 
a terminal throughput-based bonus upon trial completion. Transi-
tions (𝑠𝑡 , 𝑎𝑡 , 𝑟𝑡 , 𝑠𝑡+1) are accumulated until a batch of 𝑁 timesteps 
is collected, after which PPO updates the policy parameters 𝜃 . This 
process repeats until convergence (a fixed training horizon or a 
plateau in cumulative reward). Finally, the tuned policy is sampled 
to construct a discrete lookup table, yielding the final personalized 
transfer function. 
4 Study 1: Can TFTune Outperform a Baseline 
OS Pointing Transfer Function? 
The first study evaluated whether TFTune could be used to create 
a transfer function that could outperform an existing OS baseline. 
Starting with a constant gain of 1 (representing the case where no 
pre-established function exists) and a MacBook trackpad, we gener-
ated a personalized transfer function for each participant. We then 
compared the TFTune function to the default macOS transfer func-
tion, and additionally, included our implementation of AutoGain, as 
it is the most similar related work [30]. Replicating AutoGain’s first 
study as closely as possible allowed us to validate our experimental 
design and situate TFTune’s contributions within this established 
line of research [30]. Our study was approved by the University 
of New Brunswick’s Research Ethics Board and is on file as REB 
2024-086 
4.1 Participants and Apparatus 
We recruited 12 participants (age: 𝜇 = 26.7, 𝜎 = 3.1) from the 
local university (see Appendix B for additional information). We 
used a 2020 MacBook M1 Air (13 inch) running Sequoia 15.0.1. The 
libpointing library was used to capture the raw counts from the 
trackpad [9]. All code was implemented in Python. 
4.2 Conditions 
This study employed a repeated measures design for the indepen-
dent variable Tech with three levels: (1) macOS, (2) AutoGain, and 
(3) TFTune. The conditions were counterbalanced across partici-
pants using a Latin square design. 
4.2.1 (macOS). The macOS condition (i.e. the default macOS trans-
fer function) was used as the established baseline against which we 
were comparing. For each user, the speed setting remained at the 
default setting of four, unless participants had a different setting 
applied on their own machines. 
4.2.2 (AutoGain). We re-implemented AutoGain in Python by ref-
erencing the openly available C# implementation1 . Our implemen-
tation can be found in the supplementary material. All parameters 
were kept the same as the first AutoGain macOS experiment: the 
change rate was set to 6.4 × 10−5 𝑚𝑚−1 , the number of bins was 
150, and the speed per bin was 0.0079 m/s [30]. 
4.2.3 (TFTune). The TFTune condition, which is described in Sec-
tion 3, is the personalized function generated using our reinforce-
ment learning-based approach. Similar to AutoGain, we pre-trained 
the network to a 1:1 mapping between input and output to speed 
up the convergence. To do this, we randomly generated training 
data that represented this mapping and trained the policy network 
for 50 epochs with a learning rate of 0.001, an Adam Optimizer, and 
the mean squared error loss function. This pretraining took less 
than a minute. We leveraged most of the stable-baselines default 
parameters for the PPO algorithm [37]. The number of steps was set 
to 512, leading to an update of the transfer function approximately 
1https://github.com/SunjunKim/AutoGain 

TFTune: Creation and Personalization of Pointing Transfer Functions Using Reinforcement Learning CHI ’26, April 13–17, 2026, Barcelona, Spain 
Figure 2: (A) (Left) Shows the mean movement time (s). (Right) Shows the mean error rate (%). 95% bootstrapped confidence 
intervals (CIs) are shown with the error bars. “***” and “*” indicate significance of (𝑝 < 0.001) and (𝑝 < 0.05), respectively. (B) 
The twelve transfer functions tuned by TFTune (Left) and AutoGain (Right), where each colour represents a unique participant. 
Also shown is the average (across users) and the default macOS function extracted from libpointing. 
every 5 seconds (or 4 targets), and the activation function was set 
to ReLU. 
4.3 Task and Procedure 
The application developed to tune and evaluate the transfer func-
tion was a simple targeting task where users had to click on a 
round target located somewhere on the screen. These targets were 
generated using a similar randomization algorithm employed by 
AutoGain (i.e. targets were randomly generated with index of dif-
ficulties (IDs) of 2-5.5 and widths of 2-12 mm) [30]. During both 
tuning and evaluation, participants were instructed to complete 
each trial as “quickly and accurately as possible. ” Participants were 
required to successfully click on the target before moving on to the 
next. While different than the original AutoGain study, this was 
done to increase external validity and did not impact performance 
as the tuning was only initiated upon a successful click. 
Each of the tuning conditions had two phases: (1) transfer func-
tion creation and (2) evaluation. The baseline macOS condition only 
had an evaluation phase. Unlike the AutoGain work, we needed a 
dedicated evaluation session since the transfer function used in the 
TFTune condition takes exploratory actions, meaning it is not fully 
deterministic until after the tuning process. This meant that users 
were not becoming accustomed to a consistent function during 
the tuning process. As determined based on the time needed for 
AutoGain to achieve similar performance to the macOS function (7 
trials × 80 targets = 560) as reported by Lee et al. [30], the tuning for 
AutoGain consisted of 600 trials. The tuning for TFTune was 300 
trials. In both cases, pilot studies indicated that the chosen number 
of trials led to convergence of the respective approach. The tuning 
phase was organized into blocks of 100 trials, and the 200-trial 
evaluation stage into four blocks of 50, with pauses between blocks 
to reduce fatigue. 
4.4 Study 1: Results 
The evaluation focused on two dependent variables: the error rate 
and the movement time. All results are shown in Fig. 2. Although a 
different number of targets were acquired for each tuning strategy, 
the average tuning times for TFTune and AutoGain were 7 and 
13 minutes, respectively. AutoGain required 86% more time. 
4.4.1 Error Rate. Targets that were not selected in the first at-
tempt were marked as errors. The overall error rate was 3.1%. We 
performed a Friedman analysis, considering the non-normal distri-
bution of the data, which revealed no significant effect of Tech on 
the error rate (𝜒2 (2) =4.6, 𝑝 =0.10) (Fig. 2, A - right). 
4.4.2 Movement Time. Movement time corresponds to the time 
elapsed between two successful selections. Therefore, the first trial 
of each block was discarded, as were any trials that resulted in 
an error. A repeated measures ANOVA showed a significant main 
effect of Tech (𝐹2,121 = 7.6, 𝑝 = 0.0008, 𝜂2 = 0.11) on movement time. 
No main effect of Block and no interaction of Tech with Block 
on movement time was found. Post-hoc analysis, using Holm cor-
rections, revealed that TFTune (1.05s) was significantly faster than 
macOS (1.13s) (p=0.0005) and AutoGain (1.10s) (p=0.035). No signifi-
cant differences were found between AutoGain and macOS (p=0.15) 
(Fig. 2, A-left). On average, TFTune improved movement times by 
7% compared to macOS and 5% compared to AutoGain. 
4.4.3 Tuned Transfer Functions. Fig. 2 - B highlights the transfer 
functions after the tuning process for AutoGain and TFTune. The 
shapes of the functions tuned using AutoGain corroborate that 
our implementation of their approach was correct as they are very 
similar to the functions they obtained [30, Fig. 9]. Interestingly, 
the average function from the TFTune process is quite similar in 
shape to the macOS defaults (extracted from libpointing), with 
increased gains at low speeds. Appendix C shows a representation 
of the tuning process for one of the participants. 
4.5 Study 1: Discussion 
The results show that in ∼7 minutes of tuning, the personalized 
transfer functions generated using TFTune significantly outper-
form the macOS baseline by an average of 7%. These results high-
light that personalization, specifically with TFTune, can unlock 
benefits over the widely used macOS default. The results further 
corroborated those found in the AutoGain study, which showed 

CHI ’26, April 13–17, 2026, Barcelona, Spain Eddy et al. 
no significant differences between it and the macOS function, pro-
viding further support for our experimental design. Compared to 
prior personalization approaches (e.g. AutoGain), which only make 
adjustments based on behaviours elicited by the user, TFTune uses 
non-deterministic exploratory actions (even those that might not 
seem optimal but may lead to better mappings) to test new transfer 
function characteristics, rapidly adapting to pointing dynamics that 
drive meaningful performance gains. 
Several factors can explain the statistically significant differ-
ences between TFTune and AutoGain and the lack of significant 
differences between AutoGain and macOS. First, TFTune does not 
optimize isolated bins of a transfer function; instead, it tunes the 
parameters 𝜃 of a policy 𝜋𝜃 that represents the entire mapping 
(i.e. a neural network). Because nearby input speeds are governed 
by overlapping sets of parameters, updates at one speed propagate 
to others, preventing sharp discontinuities and avoiding sudden 
drop-offs at high speeds, even with limited data. As a result, the 
transfer functions produced by TFTune are generally smooth and 
parametric. Unlike AutoGain, which effectively memorizes bin-wise 
input–output pairs, the RL agent learns the underlying relationship 
between input and output speed. When that relationship is approx-
imately proportional, the agent extrapolates naturally, applying 
the same trend even for input speeds it has not yet (or minimally) 
observed. Additionally, the neural network’s continuous activa-
tions and shared parameters impose a smoothness bias, yielding 
gain functions that are typically smooth (and mostly monotonic), 
which suggests they can be ported across operating systems with 
minimal adaptation. Finally, and perhaps most importantly, TFTune 
optimizes throughput as a whole and can represent more complex 
relationships, whereas AutoGain only adjusts gains locally based 
on overshoots and undershoots. 
5 Study 2: Can TFTune Scale to Diverse 
Hardware and Real-World Use? 
The second study evaluated whether TFTune could scale to real-
world use. We assessed performance in a controlled lab study by 
deploying it in participants’ everyday settings (i.e. on their own 
devices) and then collected participant experience reports after a 
two-to-four-week period of at-home use. This design allowed us to 
test TFTune across diverse real-world conditions, including vari-
ations in pointing devices (with differing resolutions and polling 
rates), monitors (with different pixel densities), and computers 
(with varying computational capabilities). Specifically, we sought 
to improve performance on device–function pairings that partici-
pants had already acclimatized to over extended periods (potentially 
years) of daily use. We also wanted to ensure that no perceived 
degradation occurred when the transfer functions were deployed 
for real-world pointing in other contexts. 
Two other changes were made. First, we evaluated TFTune for 
computer mice (instead of trackpads). Second, instead of developing 
transfer functions from scratch, we used each participant’s existing 
transfer function applied on their Windows computers as a start-
ing point for the tuning (note: the Windows transfer function is 
different than the one used in macOS). Finally, while it’s possible to 
apply a transfer function at the operating system level by using the 
Windows system registry, this approach limits the resolution of the 
transfer function and, consequently, its performance. As such, we 
decided to also test the tuned function when applied at a system 
level (see Section 5.2). 
5.1 Participants and Apparatus 
We recruited 14 participants (age: 𝜇 = 26.4, 𝜎 = 2.3) from the lo-
cal university (see Appendix B for additional information). Many 
types of mice were used (ranging between 600-1600 CPI), includ-
ing standard office-style mice (e.g. Dell MS116 and Dell MOA8BO), 
higher-performance gaming mice (e.g. Logitech M170 and Razer 
Cobra), and ergonomic mice (e.g. Vassink Ergonomic Mouse). Addi-
tionally, various monitors were used, including high-resolution (4K 
desktop monitors) and lower-resolution laptop screens. 
5.2 Conditions 
This study employed a repeated measures design for the indepen-
dent variable, Tech, with three levels: (1) Win, (2) FullR, and (3) 
Reg. 
Windows (Win). The existing transfer function applied to each 
participant’s computer at the time of the experiment. 
Full Resolution (FullR). The tuned transfer function developed 
with TFTune using its full resolution, represented by an array of 
size 128 (see Section 3.3). 
Registry (Reg). The pointing transfer function used on Windows 
machines is described by the SmoothMouseXCurve and Smooth-
MouseYCurve registry values in HKEY_CURRENT_USER/Control 
Panel/Mouse2 . This function is defined by the linear interpolation 
between five points. We manually chose these points from the full 
resolution function (using a simple GUI) and applied them to the 
system registry using the winreg library. Generally, we tried to se-
lect five points to best fit the full resolution function, but prioritized 
the fit at the lower end (where most inputs occur). The computer 
was then restarted for these changes to take effect. This process 
took less than a minute. 
5.3 Task and Procedure 
We assessed each participant’s performance with their existing 
transfer function in an eight-target ISO 9241-9 Fitts’ Law test [33]. 
To account for varying difficulties, we chose target widths and dis-
tances representing the indexes of difficulty (IDs) of 2.5, 3.5, 4.7, 
and 5.2. Since all participants had screens with different resolutions 
and sizes, we opted to keep the relative position of each target con-
sistent on each screen, and the target size and distance were scaled 
accordingly to match the ID. Due to participants’ unique setups (in-
cluding the physical dimensions of each screen), we cannot report 
the actual widths of the targets after scaling; however, we are able 
to accurately report IDs. For each evaluation stage, participants 
performed three separate blocks where the IDs were presented in 
increasing order of difficulty. Following the ISO 9241-9 norm, each 
trial was completed (either successfully or unsuccessfully) after the 
first click from the user. 
We began by evaluating the performance of the default transfer 
function (i.e. the Win condition), as this was the function with 
2See: https://sugarsweetapps.com/blog/how-to-customize-mouse-acceleration-in-
windows-11-smoothmousexcurve-and-smoothmouseycurve/ - accessed March 21st, 
2025 

TFTune: Creation and Personalization of Pointing Transfer Functions Using Reinforcement Learning CHI ’26, April 13–17, 2026, Barcelona, Spain 
Figure 3: (A) (Left) Shows the average movement time (s) from blocks 2 and 3. (Middle) Shows the average error rate (%) across 
all blocks. (Right) Shows the average effective throughput (bits/s) across all blocks. 95% (CIs) are shown with the error bars. 
“***” and “**” indicate significance of (𝑝 < 0.001) and (𝑝 < 0.01). (B) The default Windows transfer function (slider position 6) and 
the personalized functions of all users. Constant hardware was assumed during their extraction. 
which participants were most familiar (some had years of practice). 
While this experimental choice may have biased the throughput 
due to ordering, introducing an unfamiliar transfer function before 
this condition could have also negatively impacted its performance 
later on, and disadvantaged the baseline. Starting with the default 
ensured that baseline measurements reflected participants’ habitual 
control. Additionally, the statistical analysis (Section 5.4) shows 
that learning effects were no longer evident after the first block. 
Although the evaluation environment in this experiment had 
targets arranged in a circle, we opted to perform the tuning in 
the same environment as Study 1 (i.e. random target generation) 
to avoid over-fitting the transfer function to specific widths and 
distances. Additionally, motivated by Study 1, we incorporated an 
early-stopping criterion: after a minimum of 50 trials, the tuning 
process terminated if performance did not improve for 10 consecu-
tive trials, typically resulting in 80–100 tuning trials in total. 
To speed up convergence, we pre-trained the policy to emulate 
the transfer function applied to each user’s computer, but scaled 
down the speed by a factor of 25%. This was done as it was de-
termined in the first experiment that the reward function tended 
toward speeding up the transfer function rather than slowing it 
down. Additionally, we bound the action space of the policy to not 
deviate more than two times the original transfer function (similar 
to common operating systems). Finally, to improve the model’s 
efficiency, we reduced the network size to a three-layer MLP (of 
32, 16, and 8 neurons) and increased the number of timesteps to 
1024 before each update. These changes made it so that the learn-
ing process was more efficient and could run on a wider range of 
computers. 
After tuning a transfer function for each user, we evaluated 
their performance when using it as emulated by its full resolution 
(FullR) and when applied at a system level in the Windows registry 
(Reg). Presentation of these two conditions was counterbalanced 
across participants and evaluated similarly to the default transfer 
function (3 blocks × 4 IDs × 32 trials). Our study was approved by 
the University of New Brunswick’s Research Ethics Board and is 
on file as REB 2024-086. 
5.4 Study 2, Part 1: Lab Study Results 
The dependent variables were the error rate, movement time, and ef-
fective throughput. All results are highlighted in Fig. 3. The average 
tuning time for participants was 1.4 minutes. All 14 participants 
agreed to keep their personalized transfer function on their com-
puters. 
Error Rate. The overall error rate was 6.7%. Participants did not 
have to correct for errors, which likely explains the higher error 
rate. We performed a Friedman analysis, which revealed a signif-
icant effect of Tech (𝜒2 (2) = 8.1, 𝑝 = 0.017). Wilcoxon signed-rank 
follow-up tests with Holm correction revealed significant differ-
ences (p=0.021) between Reg (7.8%) and Win (5.6%). No significant 
differences were found for the FullR (6.6%) function. 
Movement Time. Similar to Study 1, the first trial of each block 
and all errors were discarded. A repeated measures ANOVA showed 
a significant main effect of Tech (𝐹2,104 =64.7, 𝑝 =2.2 10−16 , 𝜂2 =0.55) 
and Block (𝐹2,104 = 22.6, 𝑝 = 6.9 10−9 , 𝜂2 = 0.30) on movement time. 
Post-hoc analysis, using Holm corrections, revealed significant 
differences (p<0.0001) between blocks 1 and 2, and blocks 1 and 3. 
After removing block 1 from the analysis, only a significant main 
effect of Tech remained (𝐹2,65 =31.6, 𝑝 =2.6 10−10 , 𝜂2 =0.49). Post-hoc 
analysis, using Holm corrections, revealed that FullR  (0.83s) and 
and Reg (0.83s) were significantly faster than Win (0.90s) (both 
p<0.0001). Our analysis also found the same completion time benefit 
for TFTune across IDs. 
Effective Throughput. Given the observed differences in error 
rates we evaluated the effective throughput achieved by each Tech 
to better understand the speed-accuracy tradeoff. As described by 
Mackenzie, we used the standard deviation method for calculat-
ing the effective width [33]. After excluding block 1, a repeated-
measures ANOVA revealed a significant main effect of Tech on 
throughput (𝐹2,65 =12.6, 𝑝 =2.4 ×10−5 , 𝜂2 =0.28). Post-hoc comparisons 
with Holm corrections indicated that both FullR (4.9 𝑏𝑖𝑡 .𝑠 −1) and 
Reg (5.0 𝑏𝑖𝑡 .𝑠 −1) exhibited significantly higher throughput than Win 
(4.7 𝑏𝑖𝑡 .𝑠 −1), with (p=0.0014) and (p<0.001), respectively. 

CHI ’26, April 13–17, 2026, Barcelona, Spain Eddy et al. 
5.5 Study 2, Part 2: Post At-Home Use Results 
We invited participants to complete a questionnaire reflecting on 
their experiences using their personalized transfer function after 
2–4 weeks of at-home use. The goal was to examine whether issues 
emerged when TFTune was deployed for everyday pointing tasks. 
Only 11 participants responded to the follow-up questionnaire. 
During this period, participants reported using their computers for 
typical office-type tasks (e.g. word processing, software develop-
ment, and web browsing). The results of the Likert questionnaire 
can be found in Fig. 4. Overall, 10 of the 11 participants wanted to 
keep the TFTune personalized function on their computer, and 1 
indicated that it did not matter. These responses indicate no per-
ceived performance degradation was found when using the tuned 
function during daily use. 
Figure 4: The questionnaire answers from 11 participants 
after a 2-4 week period of at-home use with the personalized 
TFTune function. 
5.6 Study 2: Discussion 
Study 2 showed that TFTune, when applied directly on each partic-
ipant’s own Windows setup with commodity mice and monitors, 
can efficiently personalize existing transfer functions—including 
long-used default and user-specific mappings—to yield substantial 
performance improvements over their everyday configurations. To 
our knowledge, such improvements over long-standing defaults 
have not previously been reported for pointing transfer functions. 
While our 2–4 week at-home deployment suggested no perceived 
degradation during real-world pointing, future work is needed to 
more rigorously evaluate the long-term effects of our approach. 
Running in-the-wild Fitts’ law experiments, however, remains chal-
lenging, as determining target size, and the beginning of a pointing 
movement, in everyday pointing contexts is non-trivial. 
Although TFTune improved movement time, it tended to pro-
duce functions that resulted in slightly higher error rates compared 
to the default Windows function, with significant differences ob-
served for the Reg condition. We believe this could be a byproduct 
of participants not being required to successfully click the target 
before completing a trial in Study 2, that is, participants had less 
reason to be accurate and prioritized speed. Moreover, the reward 
function was explicitly designed to emphasize throughput without 
penalizing mistakes, which may have further encouraged faster but 
less precise behaviour. If balancing the speed–accuracy tradeoff 
is a priority for system designers, the reward function could be 
adjusted to account for errors more directly. That said, the absolute 
difference in error rate was only 2% which is likely a marginal 
effect in terms of real-world usability. This is supported by the 
take-home study, where no participants noted any difficulties with 
acquiring targets using the TFTune-created Reg function. Impor-
tantly, it should be noted that the results remained consistent when 
evaluating the effective throughput, which explicitly accounts for 
the speed–accuracy trade-off, providing evidence that the observed 
improvements are not simply due to speed–accuracy compensation. 
6 Study 3: Can TFTune Generalize Beyond 
Conventional Pointing Devices? 
This final study was designed to evaluate the generalizability of 
TFTune to a completely new input scenario: a rate-controlled MCI 
that uses gesture recognition to control a cursor in a 1D pointing 
task. 
6.1 Participants and Apparatus 
We recruited 10 participants (age: 𝜇 = 25.9, 𝜎 = 2.21) from the local 
university. To minimize the influence of learning effects (due to the 
inherent challenge of EMG-based control), all participants had prior 
experience using MCIs. The hardware used to collect EMG signals 
was the previously commercially available Myo Armband (created 
by Thalmic Labs, eventually acquired by Meta), an 8-channel, 200 
Hz surface-EMG device. We first created a simple, user-specific 
gesture classifier by recording five repetitions of three gestures: 
(1) rest, (2) wrist flexion, and (3) wrist extension. During the 2-
second data collection window for each repetition, participants 
were instructed to evoke ‘ramp’ gestures (by slowly increasing the 
contraction intensity of the gesture), as is common when enabling 
proportional control for MCIs (i.e. stronger muscle contractions are 
mapped to faster cursor movements) [39]. The armband was placed 
on the right forearm of each participant. These data were then 
used to train a user-dependent LDA classifier to predict the three 
aforementioned gestures. All data were split into 200 ms windows 
with 50 ms increments (meaning 20 events were generated per 
second), and wavelet energy features were extracted from the signal 
[26]. The LibEMG Python library was used for implementing all 
parts of the controller [14]. 
6.2 Task 
The application developed for this study was a 1D targeting task 
(Fig. 5), inspired by recent work by Meta [24]. To acquire a target, 
participants had to align the cursor within the target bounds and 
maintain the position for 0.5 s. Cursor movement was mapped to 
wrist gestures: flexion moved the cursor left, extension moved it 
right, and the rest gesture held it stationary. The speed of the cursor 
was mapped to the contraction intensity of the recognized gesture 
(the rest gesture was associated with a speed of 0). Target widths 
varied between 6 and 12 mm in width and were randomly generated 
at least 20 mm apart from the preceding target. Each participant 
had a unique random seed, meaning that the randomized target 
generation was consistent across conditions. 
6.3 Conditions 
This study employed a repeated measures design for the indepen-
dent variable, Tech, with two levels: (1) Default and (2) TFTune. 

TFTune: Creation and Personalization of Pointing Transfer Functions Using Reinforcement Learning CHI ’26, April 13–17, 2026, Barcelona, Spain 
Figure 5: The 1D pointing environment used for tuning and 
evaluating the EMG transfer functions. The red rectangle 
and black line represent the target and cursor, respectively. 
6.3.1 Default. The Default condition is the widely adopted pro-
portional control strategy implemented in LibEMG [14]. This strat-
egy maps contraction intensity—computed as the mean absolute 
value (MAV) of the EMG signal—to a percentage of maximum vol-
untary contraction (0–100), as described in [39]. To do this, a linear 
scaling is applied to each class, using the 10th and 70th percentile 
MAVs acquired during calibration as the lower and upper bounds. 
The speed of the cursor was then determined based on the follow-
ing relationship: 𝑠𝑝𝑒𝑒𝑑 = 𝑔𝑎𝑖𝑛 × 𝑐𝑜𝑛𝑡𝑟 𝑎𝑐𝑡 𝑖𝑜𝑛 𝑖𝑛𝑡𝑒𝑛𝑠𝑖𝑡𝑦 . We selected 
an initial gain of 20 because it was the value that yielded the best 
performance in pilot testing. While there is no single standardized 
transfer function for EMG control, proportional linear mappings 
with constant gain remain the most widely used baseline in the my-
oelectric control community [14, 18, 24, 25, 39]. This likely reflects 
that MCIs typically rely on rate control, so traditional acceleration-
based pointing functions—designed for position control—cannot be 
applied directly. 
6.3.2 TFTune. The TFTune condition operated in the same man-
ner as in Studies 1 and 2, with only minor differences. It applied its 
gain function only to movements in the dx direction, the number 
of timesteps was set to 256 (resulting in an update approximately 
every 13 seconds), and the network was initialized with a constant 
gain of 20 (matching the Default mapping). 
6.4 Procedure 
Our procedure was approved by the University of New Brunswick’s 
Research Ethics Board and is on file as REB 2024-086. After partici-
pants were introduced to the study’s objective, they were immedi-
ately placed in the TFTune environment. The tuning process lasted 
50–60 trials and was completed in an average of 2.4 minutes. Once 
their personalized functions were created, participants proceeded 
to the evaluation phase. Participants were blinded to the condi-
tion being evaluated, and condition order was counterbalanced. 
Each participant completed four blocks of 25 trials (100 total) per 
condition. 
6.5 Study 3: Results 
Since participants were required to successfully acquire each tar-
get before proceeding, movement time (i.e. the time to acquire the 
target with the dwell time removed) served as the sole dependent 
variable. The results and tuned functions of each participant are 
shown in Fig. 6. The first trial of each block was removed from 
the analysis. A repeated measures ANOVA on the log-transformed 
data showed no effect of Block (𝐹1,67 =0.67, 𝑝 =0.42), indicating no 
learning effect (likely because the participant pool selected had 
prior experience with this interaction). All data were aggregated 
and a paired t-test indicated that TFTune (2.1s) was significantly 
faster than Default (2.5s) (p=0.007). 
Figure 6: (Left) Shows the mean movement time (s) averaged 
across all blocks. 95% (CIs) are shown with the error bars. “**” 
indicates significance of (p < 0.01). (Right) Shows the unique 
transfer functions generated for each participant. 
6.6 Study 3: Discussion 
MCIs provide an interesting use case because the underlying signal 
(i.e. EMG) that drives them is inherently noisy. Classifier variability, 
unintended muscle activations, and general signal noise make these 
systems far more challenging to optimize than conventional point-
ing devices. There is also growing interest in these interfaces, as 
demonstrated by recent work from Meta [24], and they have long 
been used in enabling assistive technologies, such as for the control 
of powered prostheses [16], making this a practical problem. 
Most research on EMG interfaces has focused on improving clas-
sification accuracy through new features or models [15]. Our results 
with TFTune suggest a complementary perspective. Rather than 
treating gesture classification accuracy as the sole bottleneck, sub-
stantial improvements can be achieved by optimizing the mapping 
between contraction intensity, classifier output, and control speed. 
Compared to the proportional control baseline that is standard 
in the myoelectric control field [14, 18, 25, 39], TFTune reduced 
average movement time by 16%, a significant improvement in per-
formance. Because muscle activation strategies and physiologies 
are highly unique, a one-size-fits-all mapping is unlikely to be opti-
mal. So, while cross-user classifiers have now been enabled [24], 
the next step in advancing MCIs may be the optimization of speed 
mappings through techniques like TFTune. 
7 General Discussion and Future Work 
In this work, we have presented TFTune, a reinforcement learning-
based solution for improving pointing transfer functions through 
personalization. Study 1 evaluated TFTune for creating transfer 
functions from scratch on a MacBook trackpad. In this setting, TF-
Tune produced performance improvements (within 7 minutes of 
tuning) of 7% over the macOS baseline and 5% over AutoGain (the 
most similar previous work on transfer function personalization). 
Study 2 tested whether TFTune could scale to real-world conditions 
by personalizing transfer functions on participants’ own Windows 

CHI ’26, April 13–17, 2026, Barcelona, Spain Eddy et al. 
devices and asking them to use it as their everyday pointing trans-
fer function. Using each participant’s default function as a starting 
point, TFTune converged in approximately one minute and im-
proved movement time by 8% with participants’ own hardware. 
After 2–4 weeks of at-home use, no degradation or problems were 
reported, and all participants chose to keep their personalized func-
tions. Finally, Study 3 extended TFTune to a fundamentally different 
modality, a rate-controlled MCI. Despite it being a completely dif-
ferent control context, TFTune significantly reduced movement 
time by 16%, highlighting its generalizability to other pointing 
techniques. Taken together, these results position TFTune as, to 
our knowledge, the first tuning approach that can both synthesize 
effective transfer functions from scratch and refine existing ones to-
ward more optimal behaviour, yielding performance gains that have 
not been seen since transitioning from constant to acceleration-
based gains. By leveraging personalization through reinforcement 
learning, this work marks a significant milestone for pointing in-
teractions and opens up exciting directions for future research. 
7.1 Impact of the Results 
Desktop pointing is a ubiquitous interaction used by hundreds of 
millions of people each day. The underlying transfer function that 
maps device motion to cursor response plays a central role in this 
interaction, directly influencing the usability of desktop operating 
systems such as macOS and Windows, yet current systems expose 
only coarse modifiers and offer little support for meaningful per-
sonalization. Previous automated approaches, such as AutoGain, 
have shown that it is possible to create transfer functions from 
scratch with performance comparable to OS defaults, but they do 
not improve those baselines [30]. We present the first approach, 
through the use of reinforcement learning, to significantly improve 
pointing at the transfer-function level. While many reinforcement-
learning methods struggle to converge with limited samples, TF-
Tune achieves efficient learning (< 10 minutes) by exploiting the 
structured nature of the problem, using an informative reward de-
sign, and involving the user in the loop to constrain exploration 
to plausible behaviours within a bounded action space, thereby 
reducing sample complexity and accelerating convergence. Results 
yield performance gains nearly twice those observed when mov-
ing from constant gains to acceleration-based transfer functions, 
suggesting benefits that are far from modest [10], and for highly 
personal inputs such as MCIs, improvements can be even larger 
(up to 37% for one participant). Unlike pointing-assistance tech-
niques that require information about targets or introduce new 
interaction techniques that do not generalize well to real-world en-
vironments (e.g. because they rely on task-specific knowledge [5]), 
our approach is entirely environment-independent and operates 
directly on standard transfer function mappings. 
7.2 Reward Function Tuning 
Although we identified a reward function that worked well across all 
three tasks, it should be highlighted that TFTune is an approach that 
should generalize beyond this simple reward function. Specifically, 
we believe that there are still significant improvements to be gained 
by optimizing this function. As suggested by Cruz et al., we could 
give the user some agency on what this reward function should 
prioritize [4]. For example, a user could fill out a survey before 
the tuning process about what to prioritize, or the system could 
prompt users after 𝑁 trials about how their transfer function feels. 
Without input from the user, the tuning process might seem like a 
black box, which could potentially reduce agency (e.g. optimizing 
performance might reduce comfort, leading to frustration if not 
accommodated) [11]. Nevertheless, the benefit of TFTune, compared 
to other automated approaches (e.g. [11, 30]), is that this reward 
function can be changed for any cost function or metric. Future 
work could explore optimizing the function for path efficiency or 
for minimizing overshoots and errors. Alternatively, the reward 
function could be modified depending on the application for which 
the transfer function is being tuned, meaning the user might have 
a different function for each application. 
7.3 Improving the Tuning Process 
While it might be reasonable that people train a transfer function 
by investing a minute as part of setting up a new mouse or a system, 
it seems unlikely that people will be willing to place effort in re-
tuning their function over time, even if it takes just a minute. This 
raises the question of whether ongoing or periodic re-tuning might 
be necessary. We believe it may be possible to periodically observe 
pointing tasks during real system use and collect them as input 
for re-tuning a function. If possible, it would also open the door to 
removing the explicit tuning task altogether. People could just start 
using a new system/device, and the system would adapt to their 
performance over time. One method to do this would be through 
off-policy RL, which can learn using old policies (i.e. transfer func-
tions), meaning that if we could extract rewards from a desktop 
computing environment, we could, in theory, continuously improve 
transfer functions. This would likely require extracting contextual 
information from applications (such as target size), which is cur-
rently not a trivial process. Another approach to consider would be 
to gamify the calibration environment, to help motivate the tuning 
process [17]. We will explore these ideas in our future work. 
7.4 Future Considerations 
Compared to traditional transfer functions, which rely on fixed 
formulas or lookup tables, neural networks enable modeling of 
more complex relationships while maintaining fast inference once 
trained. In our implementation, the agent used only displacement 
magnitude as input to mirror current OS transfer functions, but 
future work could explore richer feature sets (e.g. separate 𝑑𝑥 and 𝑑𝑦 
counts or temporal layers such as LSTMs [22]) to capture directional 
and dynamic properties. Additionally, because TFTune trains a 
neural network, computational requirements on personal devices 
were an issue. This constraint, however, could be alleviated by 
offloading training to cloud-based solutions, enabling lightweight 
deployment on end-user systems. 
Even though transfer functions are typically designed to work 
well across a wide range of devices and people, we show the signif-
icant impact that personalization can have on performance when 
accounting for the inherent differences between people and their 
setups. We foresee these effects being even larger for populations 
historically underrepresented in the design and evaluation of trans-
fer functions, such as individuals with motor impairments [28, 38]. 

TFTune: Creation and Personalization of Pointing Transfer Functions Using Reinforcement Learning CHI ’26, April 13–17, 2026, Barcelona, Spain 
Additionally, in contexts such as video games, a multi-billion dol-
lar industry [2], where people are very interested in performance 
improvements, our approach appears especially promising. 
One limitation of this work is that although we explore both cre-
ating transfer functions from scratch and modifying existing ones, 
we did not explicitly investigate how such personalized functions 
might inform improved global transfer functions. For example, the 
average function extracted across users could potentially serve as a 
better initialization for future personalization. Additionally, deploy-
ing TFTune-generated functions on Windows required converting 
our learned FullR mapping into a registry-compatible Reg repre-
sentation, which necessarily involves an approximation because the 
five point SmoothMouseXCurve and SmoothMouseYCurve cannot 
perfectly reproduce arbitrary nonlinear mappings. Because Study 
2 was conducted on people’s personal computers and functions 
were stored locally on participants’ machines, we did not collect 
the necessary data to quantify this approximation error (e.g., via 
MAE between FullR and its fitted Reg counterpart). Future work 
should investigate principled methods for reducing the resolution 
of learned transfer functions while minimizing approximation er-
ror and preserving performance. Such methods would be broadly 
applicable not only to TFTune but also to AutoGain and future 
approaches that generate nuanced nonlinear mappings. 
8 Conclusion 
This work proposes and evaluates TFTune, a novel reinforcement 
learning–based solution for transfer function tuning. Our results 
show that TFTune can significantly improve the default pointing 
transfer functions used by common operating systems, with perfor-
mance gains of 7% on macOS and 8% on Windows. The approach 
converges quickly, requiring only about seven minutes to create 
transfer functions from scratch and about one minute to person-
alize an existing mapping. We further demonstrate the scalability 
of TFTune across diverse pointing hardware (mice, displays, and 
computers) and its generalizability to an MCI, where it improved 
performance by 16% after just two minutes of tuning. Together, 
these findings highlight the promise of reinforcement learning 
to create optimized, personalized transfer functions and suggest 
broader applicability to other input-output mappings. 
Acknowledgments 
We would like to thank Mitacs and the Natural Sciences and Engi-
neering Research Council of Canada (NSERC) for graciously fund-
ing this project. 
Code Availability 
Code available at: https://ns.inria.fr/loki/TFTune/. 
References 
[1] M. Mehdi Afsar, Trafford Crump, and Behrouz Far. 2022. Reinforcement Learning 
based Recommender Systems: A Survey. ACM Comput. Surv. 55, 7, Article 145 
(Dec. 2022), 38 pages. https://doi.org/10.1145/3543846 
[2] Joseph Ahn, William Collis, and Seth Jenny. 2020. The one billion dollar myth: 
Methods for sizing the massively undervalued esports revenue landscape. Inter-
national Journal of Esports 1, 1 (2020). 
[3] Axel Antoine, Sylvain Malacria, and Géry Casiez. 2017. ForceEdge: Controlling 
Autoscroll on Both Desktop and Mobile Computers Using the Force. In Proceedings 
of the 2017 CHI Conference on Human Factors in Computing Systems (Denver, 
Colorado, USA) (CHI ’17). Association for Computing Machinery, New York, NY, 
USA, 3281–3292. https://doi.org/10.1145/3025453.3025605 
[4] Christian Arzate Cruz and Takeo Igarashi. 2020. A Survey on Interactive Rein-
forcement Learning: Design Principles and Open Challenges. In Proceedings of 
the 2020 ACM Designing Interactive Systems Conference (Eindhoven, Netherlands) 
(DIS ’20). Association for Computing Machinery, New York, NY, USA, 1195–1209. 
https://doi.org/10.1145/3357236.3395525 
[5] Ravin Balakrishnan. 2004. “Beating” Fitts’ law: virtual enhancements for pointing 
facilitation. International Journal of Human-Computer Studies 61, 6 (2004), 857– 
874. 
[6] Scott Bateman, Regan L. Mandryk, Tadeusz Stach, and Carl Gutwin. 2011. Target 
assistance for subtly balancing competitive play. In Proceedings of the SIGCHI 
Conference on Human Factors in Computing Systems (Vancouver, BC, Canada) 
(CHI ’11). Association for Computing Machinery, New York, NY, USA, 2355–2364. 
https://doi.org/10.1145/1978942.1979287 
[7] Christopher Berner, Greg Brockman, Brooke Chan, Vicki Cheung, Przemys-
law Debiak, Christy Dennison, David Farhi, Quirin Fischer, Shariq Hashme, 
Christopher Hesse, Rafal Józefowicz, Scott Gray, Catherine Olsson, Jakub Pa-
chocki, Michael Petrov, Henrique Pondé de Oliveira Pinto, Jonathan Raiman, 
Tim Salimans, Jeremy Schlatter, Jonas Schneider, Szymon Sidor, Ilya Sutskever, 
Jie Tang, Filip Wolski, and Susan Zhang. 2019. Dota 2 with Large Scale 
Deep Reinforcement Learning. CoRR abs/1912.06680 (2019). arXiv:1912.06680 
http://arxiv.org/abs/1912.06680 
[8] Evan Campbell, Ethan Eddy, Xavier Isabel, Scott Bateman, Benoit Gosselin, Ulysse 
Côté-Allard, and Erik Scheme. 2025. Screen Guided Training Does Not Capture 
Goal-Oriented Behaviors: Learning Myoelectric Control Mappings From Scratch 
Using Context Informed Incremental Learning. IEEE Transactions on Neural 
Systems and Rehabilitation Engineering 33 (2025), 332–342. https://doi.org/10. 
1109/TNSRE.2024.3518059 
[9] Géry Casiez and Nicolas Roussel. 2011. No more bricolage! methods and tools to 
characterize, replicate and compare pointing transfer functions. In Proceedings of 
the 24th Annual ACM Symposium on User Interface Software and Technology (Santa 
Barbara, California, USA) (UIST ’11). Association for Computing Machinery, New 
York, NY, USA, 603–614. https://doi.org/10.1145/2047196.2047276 
[10] Géry Casiez, Daniel Vogel, Ravin Balakrishnan, and Andy Cockburn. 2008. The 
impact of control-display gain on user performance in pointing tasks. Human– 
computer interaction 23, 3 (2008), 215–250. 
[11] Liwei Chan, Yi-Chi Liao, George B Mo, John J Dudley, Chun-Lien Cheng, Per Ola 
Kristensson, and Antti Oulasvirta. 2022. Investigating Positive and Negative Qual-
ities of Human-in-the-Loop Optimization for Designing Interaction Techniques. 
In Proceedings of the 2022 CHI Conference on Human Factors in Computing Systems 
(New Orleans, LA, USA) (CHI ’22). Association for Computing Machinery, New 
York, NY, USA, Article 112, 14 pages. https://doi.org/10.1145/3491102.3501850 
[12] Amber HY Chou, Maneeshika Madduri, Si Jia Li, Jason Isa, Andrew Christensen, 
Finley Hutchison, Samuel A Burden, and Amy L Orsborn. 2024. Using eye gaze 
to train an adaptive myoelectric interface. bioRxiv (2024), 2024–04. 
[13] Morgan Dixon, James Fogarty, and Jacob Wobbrock. 2012. A general-purpose 
target-aware pointing enhancement using pixel-level analysis of graphical inter-
faces. In Proceedings of the SIGCHI Conference on Human Factors in Computing 
Systems (Austin, Texas, USA) (CHI ’12). Association for Computing Machinery, 
New York, NY, USA, 3167–3176. https://doi.org/10.1145/2207676.2208734 
[14] Ethan Eddy, Evan Campbell, Angkoon Phinyomark, Scott Bateman, and Erik 
Scheme. 2023. LibEMG: An Open Source Library to Facilitate the Exploration 
of Myoelectric Control. IEEE Access 11 (2023), 87380–87397. https://doi.org/10. 
1109/ACCESS.2023.3304544 
[15] Ethan Eddy, Erik J Scheme, and Scott Bateman. 2023. A Framework and Call to 
Action for the Future Development of EMG-Based Input in HCI. In Proceedings 
of the 2023 CHI Conference on Human Factors in Computing Systems (Hamburg, 
Germany) (CHI ’23). Association for Computing Machinery, New York, NY, USA, 
Article 145, 23 pages. https://doi.org/10.1145/3544548.3580962 
[16] K. Englehart and B. Hudgins. 2003. A robust, real-time control scheme for 
multifunction myoelectric control. IEEE Transactions on Biomedical Engineering 
50, 7 (2003), 848–854. https://doi.org/10.1109/TBME.2003.813539 
[17] David R. Flatla, Carl Gutwin, Lennart E. Nacke, Scott Bateman, and Regan L. 
Mandryk. 2011. Calibration games: making calibration tasks enjoyable by adding 
motivating game elements. In Proceedings of the 24th Annual ACM Symposium on 
User Interface Software and Technology (Santa Barbara, California, USA) (UIST 
’11). Association for Computing Machinery, New York, NY, USA, 403–412. https: 
//doi.org/10.1145/2047196.2047248 
[18] Filip Gasparic, Nikola Jorgovanovic, Christian Hofer, Michael F. Russold, Mario 
Koppe, Darko Stanisic, and Strahinja Dosen. 2023. Nonlinear Mapping From EMG 
to Prosthesis Closing Velocity Improves Force Control With EMG Biofeedback. 
IEEE Transactions on Haptics 16, 3 (2023), 379–390. https://doi.org/10.1109/TOH. 
2023.3293545 
[19] Ivo Grondman, Lucian Busoniu, Gabriel AD Lopes, and Robert Babuska. 2012. 
A survey of actor-critic reinforcement learning: Standard and natural policy 
gradients. IEEE Transactions on Systems, Man, and Cybernetics, part C (applications 
and reviews) 42, 6 (2012), 1291–1307. 

CHI ’26, April 13–17, 2026, Barcelona, Spain Eddy et al. 
[20]
 Daya Guo, Dejian Yang, Haowei Zhang, Junxiao Song, Ruoyu Zhang, Runxin 
Xu, Qihao Zhu, Shirong Ma, Peiyi Wang, Xiao Bi, et al. 2025. Deepseek-r1: 
Incentivizing reasoning capability in llms via reinforcement learning. arXiv 
preprint arXiv:2501.12948 (2025). 
[21] Raiza Hanada, Damien Masson, Géry Casiez, Mathieu Nancel, and Sylvain 
Malacria. 2021. Relevance and Applicability of Hardware-independent Pointing 
Transfer Functions. In The 34th Annual ACM Symposium on User Interface Software 
and Technology (Virtual Event, USA) (UIST ’21). Association for Computing Ma-
chinery, New York, NY, USA, 524–537. https://doi.org/10.1145/3472749.3474767 
[22] Sepp Hochreiter and Jürgen Schmidhuber. 1997. Long short-term memory. Neural 
computation 9, 8 (1997), 1735–1780. 
[23] Leslie Pack Kaelbling, Michael L Littman, and Andrew W Moore. 1996. Rein-
forcement learning: A survey. Journal of artificial intelligence research 4 (1996), 
237–285. 
[24] Patrick Kaifosh, Thomas R. Reardon, and CTRL-labs at Reality Labs. 2025. A 
generic non-invasive neuromotor interface for human-computer interaction. 
Nature (23 Jul 2025). https://doi.org/10.1038/s41586-025-09255-w 
[25] Ernest N Kamavuako, Erik J Scheme, and Kevin B Englehart. 2014. Combined 
surface and intramuscular EMG for improved real-time myoelectric control 
performance. Biomedical Signal Processing and Control 10 (2014), 102–107. 
[26] Rami N. Khushaba, Sarath Kodagoda, Sara Lal, and Gamini Dissanayake. 2011. 
Driver Drowsiness Classification Using Fuzzy Wavelet-Packet-Based Feature-
Extraction Algorithm. IEEE Transactions on Biomedical Engineering 58, 1 (2011), 
121–131. https://doi.org/10.1109/TBME.2010.2077291 
[27] Seonho Kim, Munjeong Kim, Jonghyun Kim, Donghyeon Kang, Sunjun Kim, and 
Byungjoo Lee. 2025. Hardware-Embedded Pointing Transfer Function Capable of 
Canceling OS Gains. In Proceedings of the 2025 CHI Conference on Human Factors 
in Computing Systems (CHI ’25). Association for Computing Machinery, New 
York, NY, USA, Article 852, 15 pages. https://doi.org/10.1145/3706598.3714076 
[28] Heidi Horstmann Koester and Jennifer Mankowski. 2014. Automatic adjustment 
of mouse settings to improve pointing performance. Assistive Technology 26, 3 
(2014), 119–128. 
[29] Thomas Langerak, Sammy Christen, Mert Albaba, Christoph Gebhardt, Christian 
Holz, and Otmar Hilliges. 2024. MARLUI: Multi-Agent Reinforcement Learning 
for Adaptive Point-and-Click UIs. Proc. ACM Hum.-Comput. Interact. 8, EICS, 
Article 253 (June 2024), 27 pages. https://doi.org/10.1145/3661147 
[30] Byungjoo Lee, Mathieu Nancel, Sunjun Kim, and Antti Oulasvirta. 2020. Auto-
Gain: Gain Function Adaptation with Submovement Efficiency Optimization. In 
Proceedings of the 2020 CHI Conference on Human Factors in Computing Systems 
(Honolulu, HI, USA) (CHI ’20). Association for Computing Machinery, New York, 
NY, USA, 1–12. https://doi.org/10.1145/3313831.3376244 
[31] Yi-Chi Liao, Ruta Desai, Alec M Pierce, Krista E. Taylor, Hrvoje Benko, Tanya R. 
Jonker, and Aakar Gupta. 2024. A Meta-Bayesian Approach for Rapid Online 
Parametric Optimization for Wrist-based Interactions. In Proceedings of the 2024 
CHI Conference on Human Factors in Computing Systems (Honolulu, HI, USA) 
(CHI ’24). Association for Computing Machinery, New York, NY, USA, Article 
410, 38 pages. https://doi.org/10.1145/3613904.3642071 
[32] Yi-Chi Liao, Paul Streli, Zhipeng Li, Christoph Gebhardt, and Christian Holz. 
2025. Continual Human-in-the-Loop Optimization. In Proceedings of the 2025 
CHI Conference on Human Factors in Computing Systems (CHI ’25). Association 
for Computing Machinery, New York, NY, USA, Article 795, 26 pages. https: 
//doi.org/10.1145/3706598.3713603 
[33] I Scott MacKenzie. 2018. Fitts’ law. The wiley handbook of human computer 
interaction 1 (2018), 347–370. 
[34] David E Meyer, Richard A Abrams, Sylvan Kornblum, Charles E Wright, and JE 
Keith Smith. 1988. Optimality in human motor performance: ideal control of 
rapid aimed movements. Psychological review 95, 3 (1988), 340. 
[35] Mathieu Nancel, Olivier Chapuis, Emmanuel Pietriga, Xing-Dong Yang, 
Pourang P. Irani, and Michel Beaudouin-Lafon. 2013. High-precision point-
ing on large wall displays using small handheld devices. In Proceedings of the 
SIGCHI Conference on Human Factors in Computing Systems (Paris, France) 
(CHI ’13). Association for Computing Machinery, New York, NY, USA, 831–840. 
https://doi.org/10.1145/2470654.2470773 
[36] Antti Oulasvirta, Jussi P. P. Jokinen, and Andrew Howes. 2022. Computational 
Rationality as a Theory of Interaction. In Proceedings of the 2022 CHI Conference 
on Human Factors in Computing Systems (New Orleans, LA, USA) (CHI ’22). 
Association for Computing Machinery, New York, NY, USA, Article 359, 14 pages. 
https://doi.org/10.1145/3491102.3517739 
[37] Antonin Raffin, Ashley Hill, Adam Gleave, Anssi Kanervisto, Maximilian Ernestus, 
and Noah Dormann. 2021. Stable-Baselines3: Reliable Reinforcement Learning 
Implementations. Journal of Machine Learning Research 22, 268 (2021), 1–8. 
http://jmlr.org/papers/v22/20-1364.html 
[38] Guarionex Salivia and Juan Pablo Hourcade. 2013. PointAssist: assisting indi-
viduals with motor impairments. In Proceedings of the SIGCHI Conference on 
Human Factors in Computing Systems (Paris, France) (CHI ’13). Association for 
Computing Machinery, New York, NY, USA, 1213–1222. https://doi.org/10.1145/ 
2470654.2466157 
[39] Erik Scheme, Blair Lock, Levi Hargrove, Wendy Hill, Usha Kuruganti, and Kevin 
Englehart. 2013. Motion normalized proportional control for improved pattern 
recognition-based myoelectric control. IEEE Transactions on Neural Systems and 
Rehabilitation Engineering 22, 1 (2013), 149–157. 
[40] John Schulman, Filip Wolski, Prafulla Dhariwal, Alec Radford, and Oleg Klimov. 
2017. Proximal Policy Optimization Algorithms. CoRR abs/1707.06347 (2017), 1 – 
12. arXiv:1707.06347 http://arxiv.org/abs/1707.06347 
[41] David Silver, Thomas Hubert, Julian Schrittwieser, Ioannis Antonoglou, Matthew 
Lai, Arthur Guez, Marc Lanctot, Laurent Sifre, Dharshan Kumaran, Thore Graepel, 
et al. 2018. A general reinforcement learning algorithm that masters chess, shogi, 
and Go through self-play. Science 362, 6419 (2018), 1140–1144. 
[42] Patrick Slade, Christopher Atkeson, J Maxwell Donelan, Han Houdijk, Kimberly A 
Ingraham, Myunghee Kim, Kyoungchul Kong, Katherine L Poggensee, Robert 
Riener, Martin Steinert, et al. 2024. On human-in-the-loop optimization of human– 
robot interaction. Nature 633, 8031 (2024), 779–788. 
[43] Richard S Sutton, David McAllester, Satinder Singh, and Yishay Mansour. 1999. 
Policy gradient methods for reinforcement learning with function approximation. 
Advances in neural information processing systems 12 (1999), 1057–1063. 
[44] Xu Wang, Sen Wang, Xingxing Liang, Dawei Zhao, Jincai Huang, Xin Xu, Bin 
Dai, and Qiguang Miao. 2024. Deep Reinforcement Learning: A Survey. IEEE
 
Transactions on Neural Networks and Learning Systems 35, 4 (2024), 5064–5078. 
https://doi.org/10.1109/TNNLS.2022.3207346 
[45] Christopher JCH Watkins and Peter Dayan. 1992. Q-learning. Machine learning 
8 (1992), 279–292. 
[46] Jaesik Yun, Youn-kyung Lim, Kee-Eung Kim, and Seokyoung Song. 2015. In-
teractivity crafter: an interactive input-output transfer function design tool for 
interaction designers. Archives of Design Research 28, 3 (2015), 21–37. 
A Likert Questions 
In experiment 2, participants were prompted with the following 
five-point Likert-style questions: 
(Q1) I noticed a difference between the custom function and my 
old function 
(Q2) The custom transfer function started to feel natural after 
using it (post experiment) 
(Q3) I was better at certain tasks using the custom transfer func-
tion 
(Q4) I was worse at certain tasks using the custom transfer func-
tion 
(Q5) I felt frustrated while using the custom transfer function 
B Participant Demographics 
B.1
 Experiment 1 
All participants engaged with computers daily, with 3/12 using 
macOS as their primary operating system and an additional 7/12 
having used macOS as their primary operating system at some 
point. The other two participants had exclusively used Windows. 
Of the macOS users, only two had ever changed the macOS tracking 
speed from the default position of four (one person to three and 
one person to six). 
B.2 Experiment 2 
13 participants used Windows as their primary operating system, 
and all used a computer mouse daily. Only 3 of the participants 
knew the resolution of their mouse, and although 12 of the par-
ticipants knew that they could change the speed of their cursor 
in the Windows settings, only 8 of them had ever done so, with 
some opting to change the resolution of their mouse itself instead 
(e.g. through the Razer or Logitech applications installed on their 
computers). 

TFTune: Creation and Personalization of Pointing Transfer Functions Using Reinforcement Learning CHI ’26, April 13–17, 2026, Barcelona, Spain 
C Tuning Process (Experiment 1) 
Figure 7: A depiction of the TFTune tuning process for one 
participant (P4). Top (Left) Shows a histogram of the user’s 
input space during the tuning (log scaled). Top (Right) Shows 
the evolution of the reward throughout the tuning phase. 
(Bottom) Shows the evolution of the transfer function (start-
ing from a 1:1 mapping). 