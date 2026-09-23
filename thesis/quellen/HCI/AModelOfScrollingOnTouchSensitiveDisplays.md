# AModelOfScrollingOnTouchSensitiveDisplays

Quelle: C:\Users\Felix\Desktop\Master\Thesis\Quellen\HCI\AModelOfScrollingOnTouchSensitiveDisplays.pdf

---
A Model of Scrolling on Touch-Sensitive Displays
Jian Zhaoa,∗, R. William Soukoreffa, Xiangshi Renb, Ravin Balakrishnana
aDepartment of Computer Science, University of Toronto,
10 King’s College Road, Toronto, Ontario, Canada M5S 3G4
bSchool of Information, Kochi University of Technology,
Miyanokuchi 185, Tosayamada-Cho Kami-shi, Kochi, Japan 782-8502
Abstract
Scrolling interaction is a common and frequent activity allowing users to browse content that is initially off-screen. With the
increasing popularity of touch-sensitive devices, gesture-based scrolling interactions (e.g., ﬁnger panning and ﬂicking) have become
an important element in our daily interaction vocabulary. However, there are currently no comprehensive user performance models
for scrolling tasks on touch displays. This paper presents an empirical study of user performance in scrolling tasks on touch
displays. In addition to three geometrical movement parameters — scrolling distance, display window size, and target width, we
also investigate two other factors that could affect the performance, i.e., scrolling modes — panning and ﬂicking, and feedback
techniques — with and without distance feedback. We derive a quantitative model based on four formal assumptions that abstract
the real-world scrolling tasks, which are drawn from the analysis and observations of user scrolling actions. The results of a control
experiment reveal that our model generalizes well for direct-touch scrolling tasks, accommodating different movement parameters,
scrolling modes and feedback techniques. Also, the supporting blocks of the model, the four basic assumptions and three important
mathematical components, are validated by the experimental data. In-depth comparisons with existing models of similar tasks
indicate that our model performs the best under different measurement criteria. Our work provides a theoretical foundation for
modeling sophisticated scrolling actions, as well as offers insights into designing scrolling techniques for next-generation touch
input devices.
Keywords:
Modeling, touch displays, scrolling, Fitts’ law
1. Introduction
Scrolling is an important and widely used interaction tech-
nique that allows users to browse and navigate large amounts
of content with limited physical screen sizes, both on classi-
cal desktop interfaces and on mobile computing devices. Es-
sentially, scrolling moves a display window as a viewport over
a larger virtual workspace to reveal regions of interest, which
happens very frequently in our daily activities such as docu-
ment reviewing, image editing, and map searching. For exam-
ple, Byrne et al. (1999) report that users spent approximately
40 minutes on simply scrolling documents during a 5 hour web
browsing session. Therefore a small improvement in the efﬁ-
ciency of scrolling can provide signiﬁcant beneﬁts to users.
On traditional desktops, scrolling is effective when per-
formed by indirect input techniques such as rolling the mouse
wheel or dragging the mouse pointer. However, as touch-
sensitive devices become more popular, where gestures dom-
inate and computer mice are typically not used, traditional
scrollbars are less practical especially given extremes in display
∗Corresponding author. Tel.: +1 647 818 1919
Email addresses: jianzhao@dgp.toronto.edu (Jian Zhao),
will@dgp.toronto.edu (R. William Soukoreff), xsren@acm.org
(Xiangshi Ren), ravin@dgp.toronto.edu (Ravin Balakrishnan)
sizes (whether very large or small), as is often the case with
tabletop or mobile devices (Aliakseyeu et al., 2008). There-
fore the user usually approaches the target by iteratively manip-
ulating the device with pan or ﬂick gestures which are direct
input techniques that mimic the familiar actions of throwing
objects or shifting content. While these pan and ﬂick gestures
are similar to traditional scrolling in that they gradually reveal
off-screen content linearly, they comprise a multi-step process
that is not as simple as traditional aimed pointing. As such
scrolling operations on touch displays become an important el-
ement in our daily interaction vocabulary, it is critical that we
gain a better understanding of the mechanisms underlying how
users perform such actions.
However, very few studies exist that explore the fundamen-
tals of scrolling interactions on touch displays. Further, a com-
prehensive usability model has not yet been developed for them.
Movement models enable researchers to improve existing user
interfaces and to create novel interaction techniques. For ex-
ample, the ability to predict movement times has directly led
Fitts’ law (Fitts, 1954) to be used for comparing and improving
the efﬁciency of pointing devices (Soukoreff and MacKenzie,
2004). In short, current scrolling techniques on touch screens
are not built upon a solid theoretical infrastructure, thus it is
Preprint submitted to International Journal of Human-Computer Studies August 9, 2014
Author manuscript, published in International Journal of Human-Computer Studies, 72(12), pp. 805-821, 2014.
DOI: 10.1016/j.ijhcs.2014.07.003

very difﬁcult to comparatively evaluate, model, or predict hu-
man performance for the latest generation of user interfaces.
In this paper, we present an empirical study of user perfor-
mance in scrolling tasks on touch displays, in which the user
iteratively moves the viewport to reveal a target that is initially
off-screen. Our work is the ﬁrst attempt to quantitatively model
scrolling interactions with direct input methods. To approach
the problem, we start with an initial task analysis of scrolling
interactions on touch screens in a pilot study to decompose
the complicated real-world task procedure (Section 3.2). Next,
based on the analysis, we formulate four mathematical assump-
tions for the simpliﬁed and abstract scrolling task (Section 3.3)
and derive a novel quantitative model of such user interactions
(Section 3.4). We then conduct a control experiment to empir-
ically explore the effects of two scrolling interactions — pan-
ning and ﬂicking, and two target feedback conditions — with
and without distance acknowledgment (Section 4). The exper-
imental results validate the proposed model as well as the as-
sumptions and individual model components that support the
formulation of the whole model (Section 5). In addition to
the traditional R2 measurement, we further compare our model
with existing models of similar tasks under the Akaike Infor-
mation Criterion (AIC), which represents the trade-off between
model’s accuracy and complexity (Akaike, 1974). Both criteria
indicate that our model performs the best. Finally, we conduct
comprehensive discussions of the study by further analyzing ef-
fects of the model parameters and factors and providing design
implications generalized from the experiment (Section 6).
This study provides a fundamental building block for quan-
titatively modeling more sophisticated scrolling interactions
on touch displays and offers insights into designing next-
generation scrolling techniques on direct input devices. Our
speciﬁc contributions include: a novel mathematical model for
scrolling interactions with direct-touch input, basic observa-
tions, analysis and assumptions of the task nature in interaction
modeling under multi-stage pointing paradigms, an experiment
with various scrolling and content feedback techniques for val-
idating the model and its components as well as the fundamen-
tal assumptions, thorough comparisons with the pre-existing
models of similar interactions, and in-depth discussions of the
model parameters, factors and its design implications.
2. Related Work
2.1. Studies on Scrolling Techniques
There exists extensive research on interaction techniques and
user performance of scrolling interfaces on both traditional
desktop systems and new touch-sensitive devices. Zhai et al.
(1997) compared four indirect input devices in scrolling and
pointing tasks of web pages browsing. They found that a
mouse with an isometric joystick operated by the same hand
and two hands signiﬁcantly improve user performance. A very
important issue related to the performance with indirect in-
put methods is the rate of the input-output mapping, which
controls the viewport movement initiated by the device move-
ment. In particular, when the virtual workspace is very large,
users easily lose either precision or speed. One solution is to
dynamically change the mapping rate. For example, speed-
dependent automatic zooming (Igarashi and Hinckley, 2000)
and displacement-dependent auto zooming (Cockburn et al.,
2005) scale the document content based on the scrolling move-
ment parameters initiated by users. Alternatively, Cockburn
et al. (2012) proposed a technique of increase scrolling perfor-
mance by applying a gain function depending on the length of
the document to the mouse wheel events.
For touch input devices, studies have found that panning and
ﬂicking are preferred by users to classical scrollbars (John-
son, 1995; Kaptelinin, 1995). Reetz et al. (2006) developed
a ﬂicking technique called Superﬂick which improves the ac-
curacy of selecting smaller targets. But in most cases, users
have to perform multiple pan or ﬂick operations (multi-ﬂick)
to locate the target. Aliakseyeu et al. (2008) empirically
compared four multi-ﬂick techniques, and the results showed
that the compound-multi-ﬂick, which combines ﬂicking with a
displacement-based control, is preferred and as effective as the
traditional scrollbar. In contrast, clutch-free panning techniques
are proposed by Malacria et al. (2010) for large touch-sensitive
surfaces with manipulating the parameters of a sustained oscil-
lation. Since the screen sizes of mobile touch input devices are
usually limited and users may easily get lost in a large virtual
space, a number of feedback techniques have been investigated
to give users acknowledgments of the target location relative
to the viewport. For example, Halo (Baudisch and Rosenholtz,
2003), a off-screen target visualization technique, indicates the
distance and direction of the target by drawing speciﬁc arcs on
the screen. However, none of the above studies propose math-
ematical models to fundamentally explain user performance
of various scrolling techniques. The lack of a solid theoreti-
cal framework makes it difﬁcult to systematically extend these
techniques onto different devices, compare techniques using a
base model, or predict human performances in scrolling tasks.
2.2. Movement Models of Pointing and Scrolling
Fitts’ law (Fitts, 1954) is widely accepted for modeling con-
ventional rapid aimed pointing actions. Several studies have
been conducted to extend Fitts’ law to more complicated point-
ing tasks, for example, 2D and 3D target pointing (MacKenzie
and Buxton, 1992; Grossman and Balakrishnan, 2004), as well
as expandable targets (McGufﬁn and Balakrishnan, 2002). Fur-
ther, Kabbash and Buxton (1995) showed that Fitts’ law applies
when the cursor is an area and the target is a point. Using a for-
mat similar to Fitts’ law, Zhao et al. (2011) developed a model
for multi-touch object manipulation. Recently, Bi et al. (2013)
proposed FFitts’ law to model pointing tasks with touch dis-
plays based on a dual-distribution hypothesis. While similar to
one of our assumptions, they still treated the overall distribu-
tion as one single Gaussian instead of estimating the actual two
“peaks” of the summed Gaussian distributions. In addition, it
is an open question that if similar hypothesis holds for scrolling
interaction rather than touch pointing.
For scrolling tasks, Hinckley et al. (2002) ﬁrst found that
Fitts’ law can model certain scrolling patterns in the task of
searching for speciﬁc lines in a document. But when the target
2

is not known ahead of time in such document browsing tasks,
Andersen (2005) found that Fitts’ law does not hold and pro-
posed a simple linear model under the hypothesis that maxi-
mum scroll speed is a constant. Cockburn and Gutwin (Cock-
burn and Gutwin, 2009) indicated similar results in their studies
of examining Fitts’ law and the linear model for user perfor-
mance of item selection from scrolling lists. Researchers have
also investigated Fitts’ law based models for pointing tasks in
multi-scale electronic world which includes both scrolling and
zooming (Guiard and Beaudouin-lafon, 2004). However, in
general, “clutching” is avoided in Fitts’ law studies because it
reduces the ﬁt with empirical data (Casiez et al., 2008). This
is often in contrast with the behaviors observed when users ap-
proach off-screen target with touch displays.
A very similar form of interaction to the scrolling tasks
discussed above is dynamic peephole pointing , in which the
workspace is static relative to the user and the viewport moves
as a peephole over the virtual workspace. For example, one
physically moves a handheld display about in 3D as a dynamic
window to point and reveal virtual targets (Yee, 2003). Mehra
et al. (2006) ﬁrst proposed this concept to distinguish the tra-
ditional scrolling interaction, which they called static peephole
pointing, and found signiﬁcant differences between these two
conditions. For such dynamic peephole pointing, Cao et al.
(2008) proposed four mathematically similar models and ex-
perimentally validated the models by using pen input devices.
Along the same line, Rohs and Oulasvirta (2008) investigated
movement models in cases when a camera phone is used as a
magic lens to locate targets physically on the background and
virtually on the screen. These models divided the real tasks into
a two-phase Fitts’ law pointing in which the ﬁrst step is to move
the device to reveal the target on its display and the second step
is to point the target within the display viewport.
These existing studies all utilize indirect manipulation of the
scrollbars, i.e., instead of directly interacting with the display,
indirect input devices such as mice and joysticks were used.
No study has yet been published that models scrolling tasks
with pan and ﬂick gestures on touch displays. Further, all
previous studies investigated one-stage or two-stage pointing
paradigms in which each phase can be modeled by Fitts’ law.
These tasks are much simpler than scrolling on touch-enabled
devices, where acquisition of off screen targets is achieved by
panning or ﬂicking repeatedly a (possible unknown) number of
times. Therefore it is unclear whether previous models can be
applied to multi-stage scrolling interaction techniques on touch
displays. Although Casiez et al. (2007) proposed a multi-stage
model for scrolling-like tasks using a position-rate control de-
vice, one of the assumptions was that the movement time of
each stage is a constant independent with task factors, which
makes it difﬁcult to accommodate different types of devices.
Consequently, it is an open question whether user perfor-
mance in scrolling tasks with direct touch input (pan and ﬂick
gestures) is similar to that when the user interacts with a con-
ventional scrollbar using indirect input devices (mouse and joy-
stick). In this study, we aim to develop a basic quantitative
model for scrolling tasks on touch-sensitive displays. The liter-
ature (Aliakseyeu et al., 2008; Baudisch and Rosenholtz, 2003)
Figure 1: Target acquisition task with 1D scrolling. The user moves the back-
ground workspace to reveal the target by performing iterative operations within
the display window.
indicates that the particular scrolling and feedback techniques
employed can affect user performance, so our model encom-
passes these additional factors, including a range of scrolling
techniques and distance feedback mechanisms.
3. Model Formation
3.1. Problem Description
Our focus in this study is on one-dimensional pointing tasks,
which represents the ﬁrst step toward developing a more gen-
eralized theoretical framework and model for scrolling on
touch-sensitive displays. In this scenario, only part of a large
workspace is exposed through a display window. The user may
scroll the workspace by dragging the display window (in our
case, in a horizontal direction) so as to reveal the target, which
may then be selected (Figure 1). In keeping with the 1D (hor-
izontal) scrolling paradigm, we have set the vertical sizes of
the display and workspace to be equal to one another, so no
scrolling is possible or necessary in the vertical direction.
We acknowledge that scrolling vertically is another fre-
quent interaction in real-world scenarios, especially with mo-
bile phones where most of the interfaces have the portrait lay-
out. As a start, we choose to study the horizontal direction to
investigate a wider physical range of scrolling interactions by
making use of the horizontal layout, which would accommo-
date more devices with larger displays such as tablets and table-
tops. We also acknowledge that true 2D scrolling may impose
2D constraints on the movement that we overlook by limiting
ourselves to the 1D case. However this limitation is mitigated
by the fact that 1D scrolling is employed in real-world inter-
faces, for example, browsing documents and viewing lists of
pictures. So our model constitutes both necessary ground-work
for the later development of a 2D model, and yet is also a useful
model of existing systems.
As shown in Figure 1, we employ three parameters to de-
scribe the geometry of the target acquisition task:
3

– A The distance between the center of the initial display
window and the center of the target.
– S The size of the display window.
– W The width of the target.
In addition, there are two other factors that could affect the
performance of this pointing task.
– Scrolling Mode In addition to panning in which the dis-
tance and speed of the workspace movement equals that
of the user’s dragging action, various kinds of ﬂicking
techniques (Aliakseyeu et al., 2008) have been explored
on many touch input devices. Hence, we consider two
scrolling modes: panning and ﬂicking. However, in real-
world scenarios, user interactions may be a mixture of
panning and ﬂicking. In this study, we model these two
scrolling modes separately as the ﬁrst attempt.
– Distance Feedback The knowledge of how far away the
target is during the searching phase may affect the user’s
behavior. The user may scroll the workspace at a higher
speed when the distance is great, and slow down when
the display window is close to the target. Such awareness
of distance could be obtained by appropriate visualization
techniques. Therefore we consider two feedback modes:
with distance feedback and without distance feedback.
Therefore, in this study we are interested in the following
four techniques which are the cross-product of the above two
factors: panning with no distance feedback (PNF), panning
with distance feedback (PF), ﬂicking with no distance feedback
(FNF), and ﬂicking with distance feedback (FF).
3.2. Initial Task Analysis
To model the above real-world problem, we ﬁrst analyze the
characteristics of the idealized scrolling task on touch displays
shown in Figure 1, based on the previous work and our own in-
formal observations with four daily touch-sensitive device users
in a pilot study. The results are described in the following.
O1 Tasks can be divided into two phases: the searching phase
and the pointing phase. As the literature indicates (Cao
et al., 2008; Rohs and Oulasvirta, 2008; Casiez et al.,
2007), we can divide this scrolling task into two phases:
1) the searching phase, in which the user iteratively moves
the virtual workspace until the target emerges (Figure 2a),
and 2) the pointing phase, which is similar to a traditional
Fitts’ law pointing task, and commences once the search-
ing phase has made the target visible (Figure 2b). Similar
to the basic assumption of a Fitts’ law pointing task (Fitts,
1954), we assume that the user has some knowledge con-
cerning the direction of the target, and that the intention is
to reach the target as quickly and accurately as possible.
O2 The searching phase is composed of clutches with similar
properties. In the searching phase, the target moves to-
wards the display window a little bit in each pan or ﬂick
(a) searching phase
(b) pointing phase
Figure 2: Decomposition of a 1D scrolling task on touch displays: (a) in the
searching phase, the user repeatedly performs the ﬁnger-press-and-release ac-
tion loop to move the workspace; and (b) in the pointing phase when the target
is visible on the display window, the user points the target with his ﬁnger.
operation. Within each clutch, users perform the follow-
ing loop operations: press the ﬁnger at some place in the
display, drag it away from the direction of the target, re-
lease the ﬁnger, and repeat. Since the task is required to
be done quickly, the ﬁnger-press-and-release action loop is
performed continuously (without long pauses) during the
searching phase. This is also concurred with the model as-
sumptions in Casiez et al. (2007). During ﬂicking (FNF
and FF conditions) users may hold their ﬁngers in mid-air
brieﬂy as the workspace scrolls, but this action seems still
repeated rapidly and rhythmically.
O3 The ﬁnger displacement is similar enough in clutches. In
each ﬁnger-press-and-release action loop, users tend to
make rapid progress toward the target while keeping their
ﬁnger movements comfortable. For simple and fast rep-
etition, users tend to perform scrolling actions on a spe-
ciﬁc region of the display, i.e., the ﬁnger-press position and
ﬁnger-release position of each loop are similar from itera-
tion to iteration. This results in two places of interest on
the screen corresponding to the average ﬁnger-press and
release locations (Figure 3).
O4 There is a ceiling effect on the overall ﬁnger displacements.
The average ﬁnger displacement demonstrates a ceiling ef-
fect due to either the physical size of the display window
or maximum comfortable human wrist and arm motions.
When the display width is smaller, users tend to use most
of the screen area to pan or ﬂick; whereas when it is larger,
human motion limitations impose a constraint, which re-
4

Figure 3: Distributions of ﬁnger-press and ﬁnger-release positions. Each dis-
tribution is a Gaussian (red) and the overall distribution is a mixture of two
Gaussians (blue).
sults in a slower growth of the displacement with respect
to the display window size.
O5 The pointing phase has unknown starting positions. The
pointing phase is very much like a traditional Fitts’ law
task, except that the starting position, which approximately
corresponds to the ending position of the last iteration of
search phase, is unknown, especially in ﬂicking conditions
(FNF and FF) where users may overshoot because of the
ﬂicking effect. The spread of ending movement positions
has been explored for similar tasks (Cao et al., 2008; Gross-
man and Balakrishnan, 2005). For example, a Normal dis-
tribution has been found to successfully model the spread
of end movement positions in dynamic peephole pointing
tasks (Cao et al., 2008).
3.3. Assumptions and Simpliﬁcations
Similar to most of the literature for modeling real-world in-
teraction tasks, we further formalize the above task analysis into
the following four tentative assumptions to abstract and sim-
plify the complicated scrolling task, which sets the stage for the
mathematical derivations of our model in the next section.
A1 Users try to comfortably maximize their ﬁnger move-
ment displacements during the searching phase. Based
on O2 and O3, we assume that the distribution of ﬁnger-
press and ﬁnger-release positions in the scrolling itera-
tions can be statistically interpreted by a mixture of two
Gaussians (Bishop, ????) — a combination of two Nor-
mal distributions with different means and variances (i.e.,
two peaks), as shown in Figure 3. Such assumption im-
plies the quantities m1 and m2, the means of the two Gaus-
sians deﬁned by the spread of beginning and ending loca-
tions of user dragging movements, allowing for mathemati-
cally modeling the iterated ﬁnger-press-and-release actions
in the searching process (O1). Unlike Bi et al. (2013)’s
dual-distribution hypothesis where they still treat the over-
all distribution as one single Gaussian (i.e., one peak), we
want to explicitly compute the means and variances of two
Gaussians to interpret the ﬁnger movement displacements.
A2 As the ceiling effects described in O4, our assumption is
that the average ﬁnger displacement, D =|m1− m2|, has
a logarithmic relationship with S , i.e., D = a + b log2 S .
Based on A1, the average ﬁnger displacement D can be
physically interpreted by the difference of the two means
from the mixture of Gaussians model. Moreover, the aver-
age motion time for each iteration has a simple linear rela-
tionship with the displacement, i.e., T = kD + c. The un-
derlying intuition is that such linearity is indicated by the
steering law (Accot and Zhai, 1997) for dragging the cur-
sor across a straight tunnel and Cao et al. (2008)’s model
of drawing straight line strokes (Cao and Zhai, 2007).
A3 The searching phase ending position (which is identical to
the starting position of the pointing phase) is the location
that the user releases their ﬁnger for the very last time in
the last iteration of the searching phase, before attempting
to hit the target. According to O5 and Cao et al. (2008)’s
model, the assumption is that the effective pointing dis-
tance for the pointing phase is Normally distributed with
the mean kS , where k is an empirically determined con-
stant (Figure 2b).
A4 The ratio of the distance to the display window,A/S , plays
a very important role in determining the number of iter-
ations in the searching phase. Based on the analysis of
the compositions of the search phase (O2) and inspirations
from Casiez et al. (2007)’s model, we further assume that
the number of iterations has a simple linear relationship rel-
ative to the ratio A/S .
The above assumptions may have some limitations under
some circumstances since we try to formalize an ideal version
of the scrolling task in practice. For example, user performance
could be affected by the automatic viewport moving introduced
by the ﬂicking gestures (in FF and FNF conditions). The num-
ber of iterations might not be linear relative to the ratio A/S .
Further, the movement time of each clutch iteration may not
be steady. However, we argue that these assumptions may still
successfully explain such behaviors in terms of the average user
performance across the whole task. As the ﬁrst attempt of mod-
eling direct-touch scrolling, we aim to abstract, simplify and
formalize the complicated real-world interactions, like the anal-
ysis procedure in many previous work (e.g., Cao et al., 2008;
Casiez et al., 2007).
3.4. Model Derivation and Interpretation
Now we are able to derive the model grounded by the preced-
ing analysis and assumptions. According to A1 and A2, we can
represent the movement time for each iteration in the searching
phase as follows,
Titeration = kd· D + cd
= kd(ad + bd log2 S ) + cd
= ai + bi log2 S (1)
where ai = kdad + cd and bi = kdbd.
5

Combining Eq. (1) with A4, the movement time for the
searching phase is
T search = Titeration· Niteration
= (ai + bi log2 S)(
an + bn
A
S
)
= aian + aibn
A
S + anbi log2 S + bnbi
A
S log2 S
= as + bs
A
S + cs log2 S + ds
A
S log2 S (2)
where as = aian, bs = aibn, cs = anbi, and ds = bnbi. We
can further rewrite Eq. (2) in a more compact form since both
logarithm terms evaluate over S ,
T search = as + bs
A
S + cs log2 Sαs A
S +1 (3)
whereαs = ds
cs
.
According to A3, we can model the pointing phase of this
task as a conventional Fitts’ law pointing task
T point = ap + bp log2( kpS
W + c) (4)
For the sake of simplicity, we choose c to be zero, which is
the same as the derivation of the dynamic peephole pointing
model (Cao et al., 2008). Thus, the pointing phase can be mod-
eled as,
T′
point = a′
p + b′
p log2
S
W (5)
where the term kp in Eq. (4) is subsumed into the constant a′
p
using the identity log2(xy) = log2 x + log2 y.
Therefore, from Eq. (2) and Eq. (5), we can have the total
movement time
T = T search + T′
point
=
(
as + bs
A
S + cs log2 S + ds
A
S log2 S
)
+
(
a′
p + b′
p log2
S
W
)
(6)
Next we simplify the above equation by grouping the parame-
ters, thus obtaining the ﬁnal model of the scrolling task,
T = a + b A
S + c log2 S + d A
S log2 S + e log2
S
W (7)
It is interesting to note that we can further reformat Eq. (7)
by grouping the logarithm terms,
T = a + b A
S + log2
S c· S dA/S· S e
W e
= a + b A
S + log2
S dA/S +c+e
W e
= a + b A
S + e log2
S d/e·A/S +c/e+1
W
= a + b A
S + k log2
SαA/S +β
W (8)
where a, b, k = e,α = d
e , andβ = c
e + 1 are coefﬁcients.
The formulation in Eq. (8) provides a clear separation of the
constant, linear and logarithm components of the model, allow-
ing us to apply a three-part physical interpretation to the ex-
pression with the analogy of Fitts’ law and existing models as
the following. Further detail explanations of the nature of the
model will be discussed in Section 6.2 and 6.3.
– The term b A
S represents the linear part of this pointing task,
which is plausible since similar kind of linearity has been
found in studies of scrolling tasks with other interfaces.
For example, Andersen (2005) used a linear model to in-
terpret document reading tasks using traditional scrollbars;
and Casiez et al. (2007)’s model also has a linear compo-
nent in a similar format.
– The last term, by analogy with Fitts’ law, deﬁnes theeffec-
tive distance of this scrolling task asSαA/S +β. It is intuitive
that this effective distance is governed by factors A and S ,
and more importantly their ratio A/S plays a critical role.
– The power term αA/S +β of the effective distance explains
the phenomena of repeatedly moving the workspace to re-
veal the target, which has a close relationship with the ratio
A/S . The parameterα represents how quickly the user ap-
proaches the target, and while the parameter β represents
the residual part related to the pointing phase.
4. Experiment
4.1. Participants
We recruited 12 right-handed volunteers (6 females), who are
all university students, aged 20-28, with 0-2 years’ experience
using touch input devices (where 4 participants were novice
touch input users). The experiment lasted for 1.5-2 hours for
each participant. Participants were encouraged to take a rest
between blocks.
4.2. Apparatus
The experiment was conducted on a Microsoft Surface phys-
ically arranged in the conventional conﬁguration (i.e., ﬂat table-
top), but raised by a height of 40 cm. This allowed our subjects
to comfortably reach the entire display area when standing be-
side it (the lack of space for one’s knees when sitting at the
Surface, makes it difﬁcult for a seated user to reach the entire
display). The display has a 30 inch diagonal and a resolution of
1024×768 pixels (≈ 16.8 pixel/cm).
We chose the Microsoft Surface to utilize the physical di-
mensions of the display to study scrolling interactions on a
wider range of viewport sizes. Hence, only a speciﬁc rectangu-
lar region of the display was revealed, allowing us to simulate
smaller screen sizes corresponding to the experiment conditions
(Figure 4). The widths of the viewport were selected to simu-
late various display window size S in 1D scrolling; the height
was always 400 pixels ( ≈ 23.8 cm) which was large enough
to impose minimal effect on the horizontal motion (Fukutoku
et al., 2008). Participants used the ﬁngers of their preferred
6

(a)
 (b)
Figure 4: Experiment setup: (a) a snapshot of the experimental software, and
(b) a participant is doing the experiment.
hand for input, and they could only scroll the workspace hori-
zontally. We used tiled world-map images as the “document” to
be scrolled through, providing the participants with an aware-
ness of movement as they scrolled.
4.3. Techniques
As discussed above, two factors have been selected for in-
vestigation: scrolling mode (panning or ﬂicking), and feedback
mode (with or without distance feedback).
We implemented the panning technique with a one-to-one
mapping transfer function between the ﬁnger motion and view-
port motion, which was the basic conﬁguration in many inter-
faces. For the ﬂicking technique, our implementation was sim-
ilar to the multi-ﬂick-standard (Aliakseyeu et al., 2008). That
was, the scrolling speed equaled the ﬂicking speed performed
by the participant in each stroke, and the workspace contin-
ued to move at this speed if the user did not touch the surface
again. The ﬂicking speed was calculated based on the displace-
ment and time in each stroke. Subsequent ﬂicks enacted their
respective scrolling speeds. Participants did not have knowl-
edge about the detail implementation of the techniques. They
were just instructed to approach the target as quickly and pre-
cisely as possible with panning or multi-ﬂicking. We chose this
baseline implementation because there are too many commer-
cial touch-sensitive devices with numerous unknown param-
eters which are difﬁcult to interpret, although some methods
have been proposed to reverse engineer the scrolling transfer
functions (Quinn et al., 2013). In our study, as the ﬁrst step,
we aimed to propose a baseline model as the starting point for
modeling other more complex variants of ﬂicking.
For the feedback technique, we used the length of a blue bar
displayed above the viewport for indicating the relative distance
to the ﬁnal target (Figure 4b), since we wanted to keep the view
of the core workspace itself unchanged among all the technique
conditions. For each condition, the bar had the same length
at the beginning; its length scaled proportionally to the current
distance as progress was made toward the target, indicating a
general impression about how close the target was from cur-
rent location. For example, the blue bar started with the same
length (Figure 4a) and its length decreased as the participant
approached the target as shown in Figure 4b. While other tech-
niques could have been applied, we chose this simpler approach
because the length of the bar provided more explicit representa-
tion of the changing distance. For consistency, the blue bar was
also displayed for the conditions without distance feedback but
remained unchanged through the task.
4.4. Procedure
A reciprocal 1D pointing task was employed. Participants se-
lected a target (represented as a red ribbon) in each trial, and any
two successive trials were in opposing directions (to the left and
then to the right and so on). The participant was asked to choose
either their index or middle ﬁnger to interact with the surface,
and they were required to use only this ﬁnger for input during
the whole experiment. For each trial, the task was to scroll hor-
izontally towards the target (which was initially off-screen) and
successfully select it when it became visible. Participants were
not allowed to scroll backwards (i.e., away from the target) un-
til the target had appeared. Prior to each trial, participants were
required to hit a “Start” button above the viewport (Figure 4a).
This ensured a consistent start position of their ﬁnger and pre-
vented the participant from making an initial unwanted gesture
before scrolling. The start time was recorded from when the
participant ﬁrst contacted the viewport after hitting the start but-
ton. The direction of the target (left or right) was indicated by
a red circle. At the end of the trial, after the target had been
selected, the target disappeared and then a short beep sounded,
signaling to the participant that the trial had ended.
Prior to the actual experiment, participants were given 48
practice trials, 12 for each scrolling and feedback technique
combination. We recorded the movement time per trial, the
number of errors, the ﬁnger contact positions and timestamps
for each trial. After the experiment, we conducted a short infor-
mal interview with the participant by asking questions such as
“Which technique do you like best? Why?” and “Do you think
the distance feedback is helpful?”
4.5. Design
For the independent variables, we used four scrolling dis-
tances: A = 1280, 1536, 1792, 2048 pixels (76.2, 91.4, 107,
122 cm), four display window widths: S = 128, 256, 512, 1024
pixels (7.62, 15.2, 30.5, 60.9 cm), three target widths: W =
16, 32, 64 pixels (0.95, 1.90, 3.81 cm), two scrolling modes:
panning and ﬂicking, and two feedback modes: with or with-
out distance feedback. Altogether there were 192 experimental
conditions. The smallest display window was about the height
of the iPhone screen, and the largest display window was large
enough to cover the displays of all the current commercial tablet
PCs. The ratio A/S , which is in both the linear and nonlinear
components of Eq. (7), plays a very important role in the model.
Thus we tried to investigate a wide range of the variation inA/S
(from 1.25 to 16) with the experimental conditions.
A repeated measures within-subjects design was used in the
experiment. The four scrolling and feedback techniques (i.e.,
PF, PNF, FF, and FNF) were presented to participants with the
order counterbalanced across the experiment. Under each of
these techniques, participants successively selected two targets,
in opposing directions (left and right), for each of the A, S , and
7

1200 1300 1400 1500 1600 1700 1800 1900 2000 21003500
4000
4500
5000
5500
6000
A (pixels)
MT (ms)
 
 
PNF
FNF
PF
FF
(a)
100 200 300 400 500 600 700 800 900 1000 11003000
3500
4000
4500
5000
5500
6000
6500
7000
7500
S (pixels)
MT (ms)
 
 
PNF
FNF
PF
FF (b)
10 20 30 40 50 60 704200
4300
4400
4500
4600
4700
4800
4900
5000
5100
W (pixels)
MT (ms)
 
 
PNF
FNF
PF
FF (c)
Figure 5: Correlations between movement times and movement factors under different techniques: panning with no distance feedback (PNF), panning with distance
feedback (PF), ﬂicking with no distance feedback (FNF), and ﬂicking with distance feedback (FF).
W combinations presented in randomized order with 3 repeti-
tions. In summary, for each participant, the experiment con-
sisted of 4 scrolling and feedback techniques× 4 As× 4 S s× 3
Ws× 2 directions× 3 repetitions = 1152 trials.
It is interesting to note that an alternative experimental de-
sign would be to cross variables: S× A/S× W× scrolling and
feedback techniques 1. Treating A and S as independent vari-
ables in the above design would not make it convenient for us to
compare the performance of different techniques at similar lev-
els of clutching iteration numbers (which are implied by A/S ).
Thus we could chose A/S as one of the independent variables
to resolve this issue. However, this assumes a relationship be-
tween A and S , which we do not necessarily know a-priori, and
it would not be easy to compare the model performance across
the same A. Hence these two designs essentially complement
each other rather than one necessarily being a preferred alterna-
tive. For our ﬁrst attempt at validating the model, we chose the
ﬁrst design, similar to the original Fitts’ Law experiments that
were conducted in the early days of Fitts’ Law research to pro-
vide initial validation. The alternative design is left for future
work and may potentially offer additional and more complete
veriﬁcation of the model.
5. Results
5.1. Movement Times and Errors
The average of movement time T was 4687 ms for this
scrolling task. A repeated measure ANOV A test showed sig-
niﬁcant effects for A (F3,33 = 561.9, p < .001), S (F3,33 =
186.13, p< .001), and W (F2,22 = 67.72, p< .001) on T. Pair-
wise means comparisons also indicated that T increases mono-
tonically as A increases and T decreases monotonically as S
and W increases (Figure 5). There was no signiﬁcant effect
for either scrolling mode nor feedback mode on T. But there
were signiﬁcant interactions for S×scrolling mode (F3,33 =
12.41, p < .001), S×feedback mode (F3,33 = 5.212, p < .005)
and A×scroll mode (F3,33 = 6.813, p < .002). However, it
worths noting that these signiﬁcant interactions might be be-
cause of the non-overlappingA/S values for differentS ’s in our
1We thank the reviewers for pointing this out.
experimental design. Further empirical observations are needed
to make the conclusions ﬁrmly.
Figure 5 shows the correlations between the movement times
and the three movement factors under the four scrolling tech-
niques. In general, the movement times of techniques without
distance feedback (PNF and FNF) seem to be slower than those
with distance feedback (PF and FF), indicating distance ac-
knowledgment could improve the user performance under cer-
tain conditions. Several interesting ﬁndings can be identiﬁed
from these charts as follows.
First, in Figure 5a, we can see that the advantages of ﬂicking
and distance feedback tend to be negligible when A is small;
whereas when A grows larger, FF results in the fastest tech-
nique, which is plausible because ﬂicking and distance feed-
back beneﬁt more to the user for larger A. Second, as Figure 5b
shows, for smaller S , the average movement time of ﬂicking
techniques (FNF and FF) is much less than that of panning tech-
niques (PNF and PF); but for largerS , the difference tends to be
much smaller and panning are even faster for the largestS . This
may be because participants were likely to utilize more screen
width when told only simple panning was available, which re-
sulted in the viewport traveling a little faster than that in ﬂick-
ing. However, this could also due to the fact that there ex-
isted large differences of iteration numbers between variousA’s
because of our experimental design. Future additional experi-
ments as described in Section 4.5 would provide more concrete
supports. Third, Figure 5c indicates that the increasing of W
has larger inﬂuence (i.e., deeper slope) on movement times of
ﬂicking techniques (FNF and FF). The reason could be that the
marginal easiness of pointing larger targets is more signiﬁcant
with ﬂicking techniques because it makes the viewport moving
at certain speed in the pointing phase of the whole task.
An error was counted when the participants tapped outside
the target. However, especially with techniques using ﬂicking,
the participant could also tap to stop workspace from moving.
Thus in this case we measured an error only when the target was
present inside the display window and the participant tapped
within a certain distance (10 pixels,≈ 0.6 cm) beyond the edge
of the target, otherwise it was recorded as a tap to stop the
scrolling workspace. The average error rate was 3.49%. As ex-
pected, there was a signiﬁcant effect for W (F2,22 = 116.1, p <
.001) on error rate, and pairwise means comparison shows that
8

0 0.2 0.4 0.6 0.8 10
500
1000
1500
2000
2500
position
frequency
(a) Panning without feedback (PNF)
0 0.2 0.4 0.6 0.8 10
500
1000
1500
2000
2500
position
frequency (b) Panning with feedback (PF)
0 0.2 0.4 0.6 0.8 10
500
1000
1500
2000
position
frequency
(c) Flicking without feedback (FNF)
0 0.2 0.4 0.6 0.8 10
500
1000
1500
2000
position
frequency (d) Flicking with feedback (FF)
finger pressfinger release
Figure 6: Histograms of the ﬁnger-press (blue) and ﬁnger-release (red) posi-
tions on the display window. The target is on the right. The position data was
normalized (divided byS ) and was ﬂipped for conditions where the targets were
on the left, before inclusion in this graph.
the error rates for W = 16 pixels (6.64%) are much higher but
error rates are about the same for W = 32 pixels (2.08%) and
W = 64 pixels (1.76%). There was also a signiﬁcant effect for
scrolling mode ( F1,11 = 301.4, p = 0.002) in which ﬂicking
conditions (FNF and FF) have higher error rates (5.34%) than
panning conditions (PNF and PF) which were 1.65%.
5.2. Assumption Veriﬁcations
The four assumptions introduced in Section 3.3 are the foun-
dations of our model derivation. In this section, we revisit these
assumptions by verifying them with the empirical data gathered
from the experiment.
5.2.1. Finger-press and Finger-release Positions (A1)
The histograms for normalized ﬁnger pressing and releasing
positions on the display window for the four techniques are
shown in Figure 6. We clearly observe that the overall dis-
tribution of the hitting positions has two peaks, which can be
interpreted with the mixture of two Gaussians model (Bishop,
????), supporting A1. Moreover, for each technique, the one-
sample Kolmogorov-Smirnov test rejected the null hypothesis
that those hitting positions are drawn from a normal distribution
(p<. 001), indicating that our two Gaussion mixture model as-
sumption is necessary to interpret the data and Bi et al. (2013)’s
dual-distribution hypothesis does not apply here since they still
assume the overall combined distribution is a single Gaussian
(i.e., one peak).
The results of ANOV A tests indicated thatS has a signiﬁcant
effect on these hitting positions (F3,33 = 23.47, p< .001). Fur-
ther, the distances between the means of Gaussians is smaller
for the ﬂicking modes, which implies the participants could
achieve their desired scrolling speed with less effort and smaller
displacements.
0 200 400 600 800 1000 120050
100
150
200
250
300
350
400
450
500
S (pixels)
|m1−m2| (pixels)
 
 
PNF
FNF
PF
FF
Figure 7: Correlations between|m1− m2| and S under four techniques: panning
with no distance feedback (PNF), panning with distance feedback (PF), ﬂicking
with no distance feedback (FNF), and ﬂicking with distance feedback (FF).
5.2.2. Finger Displacements (A2)
We also investigated the average ﬁnger displacement for each
iteration which is represented as the distance between the two
means of Gaussians,|m1− m2|. In each technique, to compute
the means, we ran the expectation-maximization (EM) algo-
rithm (Bishop, ????) to ﬁt a mixture of two Gaussians with
the hitting positions for each display window width S . The EM
technique is an iterative method for ﬁnding maximum likeli-
hood estimates of parameters in statistical models, which are
means and variances of the two separated Gaussians here.
The trend of |m1− m2| growing with S is shown in Fig-
ure 7. We regressed the data using function y = a + b log x,
which yielded R2 > 0.98 for all techniques, supporting A2 and
also conﬁrming the ceiling effect of view size in Guiard and
Beaudouin-lafon (2004)’s study. In addition, there was a sig-
niﬁcant main effect for S (p < .001) on the movement time of
each iteration under all techniques.
5.2.3. Searching Phase Ending Positions (A3)
Though several studies have indicated that the spread of
ending positions follows a Normal distribution for similar ac-
tions (Cao et al., 2008; Grossman and Balakrishnan, 2005), re-
sults in Figure 8 provide further support for A3 in this touch
display scrolling task, especially for panning techniques (PNF
and PF). For ﬂicking techniques, the last ﬁnger-release position
could be several screens away because of the movement initi-
ated by the ﬂicking gestures.
Moreover, an ANOV A indicated thatS (F3,33 = 20.48, p <
.001), W (F2,22 = 285.2, p < .001), scrolling mode ( F1,11 =
16.35, p = 0.0019), and feedback mode ( F1,11 = 17.24, p =
0.0016) have statistically signiﬁcant effects on the spread. Note
that the means of the ending positions tend to skew in the direc-
tion of the user’s movement approaching the target. Also, the
spread of ending points for the ﬂicking actions reveal long tails
trailing away in the opposite direction. Neither of these fea-
tures resemble a Normal distribution. Thus further experiment
is warranted.
9

−1 −0.5 0 0.5 10
50
100
150
200
position
frequency
(a) Panning without feedback (PNF)
−1 −0.5 0 0.5 10
50
100
150
200
position
frequency (b) Panning with feedback (PF)
−2 −1 0 1 2 3 40
50
100
150
200
position
frequency
(c) Flicking without feedback (FNF)
−2 −1 0 1 2 3 40
50
100
150
200
position
frequency (d) Flicking with feedback (FF)
Figure 8: Histograms of the searching phase ending positions (last ﬁnger-
release positions before hitting the target). The target is at position 0 and the
participant approaches target from the right. The position data was normalized
(divided by S ) and was ﬂipped for conditions where the targets were on the left,
before inclusion in this graph.
0 2 4 6 8 10 12 14 160
5
10
15
20
25
30
A/S
number of iterations
 
 
(a) Panning without feedback (PNF)
0 2 4 6 8 10 12 14 160
5
10
15
20
25
30
A/S
number of iterations
 
 (b) Panning with feedback (PF)
0 2 4 6 8 10 12 14 160
5
10
15
20
25
30
A/S
number of iterations
 
 
(c) Flicking without feedback (FNF)
0 2 4 6 8 10 12 14 160
5
10
15
20
25
30
A/S
number of iterations
 
 (d) Flicking with feedback (FF)
Figure 9: Linear ﬁtting results of the number of iterations with respect to the
ratio A/S .
5.2.4. Iteration Numbers (A4)
In order to evaluate A4, we investigated the relationship be-
tween the number of iterations and the ratio of the distance to
the display window width, A/S . Figure 9 shows that this re-
lationship is highly linear yielding R2 > 0.96, which gives a
strong justiﬁcation for A4.
As expected, there were signiﬁcant effects for A (F3,33 =
289.7, p<. 001) and S (F3,33 = 148.8, p<. 001). Furthermore,
scrolling mode had a signiﬁcant effect ( F1,11 = 10.33, p =
0.0082) and pairwise comparison showed that ﬂicking modes
had a smaller number of iterations. We can also observe this
from the slope of the ﬁtted lines in Figure 9, in which the ones
0 2000 4000 6000 8000 100000
1000
2000
3000
4000
5000
6000
7000
8000
9000
10000
predicted MT(ms)
MT(ms)
(a) Panning without feedback (PNF)
0 2000 4000 6000 8000 100000
1000
2000
3000
4000
5000
6000
7000
8000
9000
10000
predicted MT(ms)
MT(ms) (b) Panning with feedback (PF)
0 2000 4000 6000 8000 100000
1000
2000
3000
4000
5000
6000
7000
8000
9000
10000
predicted MT(ms)
MT(ms)
(c) Flicking without feedback (FNF)
0 2000 4000 6000 8000 100000
1000
2000
3000
4000
5000
6000
7000
8000
9000
10000
predicted MT(ms)
MT(ms) (d) Flicking with feedback (FF)
Figure 10: Correlations between predicted movement times and observed
movement times.
of ﬂicking techniques have slower increasing rates with respect
to the ratio A/S .
5.3. Model Fittings
Because of the nonlinearity of the proposed model (Eq. (8)),
we ﬁt it with the experimental data by turning the process into a
nonlinear optimization problem with the objective function —
sum of squared errors between predicted and observed move-
ment times. We used function fminsearch 2 in MATLAB,
which ﬁnds the minimum of a scalar function of several vari-
ables starting at an initial estimate by using a derivative-free
method. Since this highly nonlinear object function may have
multiple local minimas, we ran the ﬁtting process for ten times
and took the average values of the solutions in the end. For each
technique, the raw data points were collapsed to experimental
conditions, i.e., 4 As× 4 S s× 3 Ws = 48 data points to be ﬁtted
in each model, by averaging the times for each condition. Ta-
ble 1 shows the estimated parameters and R2 values, indicating
that our model ﬁts the experimental data very well (R2≥ 0.97).
Figure 10 further illustrates the goodness of ﬁt between the em-
pirical and the predicted movement times.
In addition to the four mathematical assumptions, which are
veriﬁed in the preceding sections, our model is based on three
fundamental components that model the movement times in
each clutch iteration, the searching phase, and the pointing
phase (see Eq.(1), Eq.(3), and Eq.(5) respectively). To further
examine the model, we extracted the experimental data to per-
form regression analysis of the three component models indi-
vidually. For the ﬁtting of Titeration in Eq.(1), we took the aver-
age clutch iteration times in each geometry factor condition (A,
S , and W) of the four techniques. For the other two component
2http://www.mathworks.com/help/techdoc/ref/fminsearch.html
10

Techniques a (ms) b (ms) k (ms/bit) α β R2
PNF 2.36 0.002 175 0.395 1.65 0.98
PF -1.36 0.003 172 0.370 1.72 0.98
FNF -5.36 0.002 243 0.264 1.39 0.97
FF -6.54 0.001 271 0.211 1.39 0.97
Table 1: Model ﬁtting results under different techniques
Model component PNF PF FNF FF
Eq (1): Titeration = a + b log2 S 0.98 0.96 0.87 0.92
Eq (3): T search = a + b A
S + c log2 Sα A
S +1 0.97 0.98 0.97 0.98
Eq (5): T point = a + b log2
S
W 0.94 0.85 0.86 0.94
Table 2: Model ﬁtting results (R2 values) for different components.
models (T search and T point), we used similar approach of ﬁtting
the entire model above, but with the corresponding movement
times recorded in the experiment. Table 2 shows the ﬁtting re-
sults, indicating that all three model components explain the
experimental data very well with relative highR2 values, which
further assures the validity of our model. Detail information
about the ﬁtted coefﬁcients can be found in Table A.6.
Moreover, we ran similar model ﬁtting procedures for the
longer format of the model in Eq.(7) and its corresponding
searching phase in Eq. (2), since we were curious about whether
different model formulations would affect the estimation of co-
efﬁcients in this non-linear ﬁtting process. The results showed
that we encountered large negative values for coefﬁcientsa and
b in the longer model formats, which seemed not very plausi-
ble or practical. Details of the coefﬁcient values can be found
in Table A.7. We suspect that the differences might due to the
complicated parameter interactions during the iterative ﬁtting
process in two model formats, causing the solution searching
towards very different local minimas. However, future studies
with more empirical data are warranted. Thus, we suggest using
the compact model format (Eq.(7)) in practice, and if needed,
one can transform the ﬁtted parameters to those in the long for-
mat through the formulations described in Section 3.4.
5.4. Model Comparisons
This scrolling task on touch displays is similar enough to the
traditional scrolling and the dynamic peephole pointing task
that it is worth comparing our results with the models pro-
posed for these interactions. Of particular interest, the pre-
vious models are the two-part Fitts’ law models for dynamic
peephole pointing with a stylus (Cao et al., 2008) and a cam-
era phone (Rohs and Oulasvirta, 2008), the model for multi-
scale navigation using joysticks (Guiard and Beaudouin-lafon,
2004), and the clutch model for pointing with rate-control de-
vices (Casiez et al., 2007).
We compared our model with the models mentioned above.
Note that Cao et al. (2008) proposed many similar models; for
this comparison we compared our model against the best per-
forming of these models. For the multi-scale model (Guiard
and Beaudouin-lafon, 2004), we added a constant parameter a
to the equation, allowing this model to achieve a better ﬁt with
our data, because scale was not varied in our experiment. In
Casiez et al. (2007)’s model, we set the CD gain as 1 (because
we used direct touch for interaction) and the constant parameter
Tc as the average clutch time of the corresponding technique.
Results in Table 3 show that our model yields the highest R2
values for all techniques, indicating that our model ﬁts the ex-
perimental data the best. Further details about the coefﬁcients
of the model ﬁttings can be found in Table A.8 in Appendix A.
However, evaluating competing models via R2 values alone
may introduce a bias for models with different numbers of
parameters, especially for non-linear models. As the number
of parameters grows, a model’s descriptive ability will be im-
proved but the stability of estimations of parameters decreases
which may cause the model’s predictive ability decreases (Ren
et al., 2005). The goal of statistical modeling is to select a
model with strong predictive ability, but the traditional evalu-
ation method, R2, which indicates the goodness of ﬁt to the ob-
served data, cannot represent the predictive ability of the model.
A better approach for model evaluation is the Akaike Informa-
tion Criterion ( AIC) developed by statistical model selection,
which describes the trade-off between model’s accuracy, i.e.,
the descriptive ability, and model’s complexity, i.e., the stabil-
ity of parameter estimations (Akaike, 1974). AIC is deﬁned by
the maximum log-likelihood and the number of parameters to
be estimated. Based on the assumption that the model errors
are Normal independent and identically distributed (i.i.d.), the
formula is
AIC = 2k + N ln
∑ϵ2
i
N (9)
where k is the number of parameters, N is the number of
data points, and ϵi is the estimated residuals from the ﬁtted
model (Burnham and Anderson, 2004).
The model with the smallest AIC value can be regarded as
the best one and only the difference of AIC values has meaning
that is used for model selection. Denote AIC i is the AIC value
of the ith model candidate and AIC min is the minimum of those,
in practice, the quantity exp( AIC min−AIC i
2 ) can be interpreted as
the relative probability that the ith model, which measures how
probable other model as the best model minimizes the informa-
11

Model Goodness PNF PF FNF FF
Two-part Fitts’ law I (Cao et al., 2008) R2 0.90 0.90 0.87 0.88
T = a + b(n log2( A
S + 1) + (1− n) log2( A
W + 1)) AIC 613 606 618 598
Two-part Fitts’ law II (Rohs and Oulasvirta, 2008) R2 0.91 0.90 0.89 0.89
T = a + b log2( A
S + 1) + c log2( S
2W + 1) AIC 609 601 612 593
Multi-scale model (Guiard and Beaudouin-lafon, 2004) R2 0.82 0.81 0.81 0.80
T = a + k
S log2( A
W + 1) AIC 641 634 636 618
Clutch model (Casiez et al., 2007) R2 0.80 0.91 0.92 0.84
T = 2Tc⌊ A
cS⌋ + a + b log2(
A−cS⌊ A
cS⌋
W + 1) AIC 651 602 593 613
Our model R2 0.98 0.98 0.97 0.97
T = a + b A
S + k log2
SαA/S +β
W AIC 546 540 559 533
Table 3: Comparisons of models under two criteria.
tion loss (Burnham and Anderson, ????). As Table 3 shows,
our model yielded the smallest AIC values with the minimum
difference ∆AIC = 64 across all the techniques and all the mod-
els, which means the relative probability of other models is no
larger than e−26 that is a fairly small number. Thus our model
outperforms the others under this evaluation method as well.
5.5. Informal Interview Results
We conducted a short informal interview following the ex-
periment to quantify the participants’ subjective opinions of
the four scrolling and feedback conditions. We expected ﬂick-
ing with distance feedback to be the most preferred technique.
However, only 7 of the 12 participants regarded it as their pre-
ferred method and most of these (6 out of the 7) had at least one
year of experience using touch input devices such as iPhone
and iTouch. For novice participants with no experience, 3 out
of 4 preferred the panning techniques. They found the ﬂicking
hard to control and they sometimes overshot the display win-
dow. Ten participants felt that the distance feedback was very
helpful especially when S is small and the other two felt that it
was only somewhat helpful. All participants with prior experi-
ence of using touch-input reported that they frequently use the
gestures employed in the experiment for daily scrolling tasks.
6. Discussion
6.1. Model Comparison In-Depth
While the performance of our model is the best under these
two criteria, one may wonder whether that the two-part Fitts’
law models (Cao et al., 2008; Rohs and Oulasvirta, 2008) or
the clutch model (Casiez et al., 2007) might be adequate when
precision is not highly required, because they generated around
0.9 R2 values under some techniques. However, we believe that
these models may not truly represent the nature of this scrolling
task. It is a question that if the two successive phases of the
task (searching phase and pointing phase) can be explained as
the model’s state, because the 0.9 R2 values may due to the
interactions of different parts of the model and its parameters.
The pointing phase is very similar to a traditional pointing task
modeled by Fitts’ law (Fitts, 1954), which has been validated
in many literatures and has similar mathematical formats in
all of these models including ours. In the case of modeling
scrolling tasks on touch screens, the searching phase dominates
the movement time of the whole task (78% on average from
our experimental data). So it is critical for a model to reﬂect
the task nature by well interpreting the searching phase with its
corresponding component.
Hence, we conducted similar comparison procedures in Sec-
tion 5.4 by ﬁtting the corresponding model components to the
times of the searching phase only. After eliminating the second
pointing phase part, both the two-part Fitts’ law models (Cao
et al., 2008; Rohs and Oulasvirta, 2008) are reduced to Fitts’
law, and the clutch model (Casiez et al., 2007) turns into a lin-
ear form. The searching phase of our model, i.e., Eq. (3), is
already veriﬁed with the experimental data in Section 5.3. As
Table 4 shows, the other two models have large decreases in
performances, in contrast our model still yields very high R2
values. Detail results of the parameter values are shown in Ta-
ble A.9 in Appendix A. Therefore, dynamic peephole pointing
and clutching with rate-control devices are different tasks in na-
ture from this direct-touch scrolling task concerned in this pa-
per. It further indicates that we need different models for those
tasks, and our model well explains the nature of this scrolling
tasks so that it can provide valuable implications in practice.
6.2. Model and Parameters
From the ﬁtting results in Table 1, we may tentatively inter-
pret the meaning of the estimated parameters in terms of the un-
derlying physical meaning of the static peephole pointing task
in the multi-stage scrolling paradigm. The effective distance of
this scrolling task, SαA/S +β, is affected by parameters α andβ.
In particular, the parameter α describes the nature of the tech-
nique where smaller values typically indicate faster techniques.
As shown in Table 1, the values ofα for ﬂicking techniques are
relatively smaller than for panning techniques. In addition, the
parameterβ, which represents the residual part of the repeated
movement, has smaller values for ﬂicking techniques as well,
which indicates that the pointing phase of the ﬂicking action
12

Model Goodness PNF PF FNF FF
Two-part Fitts’ law (searching phase) R2 0.82 0.82 0.80 0.82
T search = a + b log2( A
S + 1) AIC 610 604 614 592
Clutch model (searching phase) R2 0.59 0.50 0.54 0.35
T search = 2Tc⌊ A
cS⌋ AIC 692 694 689 692
Our model (searching phase) R2 0.97 0.98 0.97 0.98
T search = a + b A
S + c log2 Sα A
S +1 AIC 540 552 557 552
Table 4: Comparisons of model ﬁttings to the searching phase of the whole scrolling task.
Model Goodness PNF PF FNF FF
Our model I R2 0.98 0.98 0.97 0.97
T = a + b A
S + k log2
SαA/S +β
W AIC 546 540 559 533
Our model II R2 0.96 0.97 0.97 0.96
T = a + k log2
SαA/S +β
W AIC 568 550 556 542
Our model I (searching phase) R2 0.97 0.98 0.97 0.98
T search = a + b A
S + k log2(SαA/S ) AIC 540 552 557 552
Our model II (searching phase) R2 0.98 0.98 0.97 0.97
T search = a + k log2(SαA/S ) AIC 550 538 555 538
Table 5: Comparisons of the new model and the original model for both the whole scrolling task and only the searching phase.
contributes less. This may be because the continued sliding of
the workspace followed by each ﬂick operation, to some extent,
reduces the effort for pointing at the target.
Parameters b and k represent the weights of the linear and
nonlinear components respectively. From Table 1, we can ob-
serve that the relative ratio k/b is larger for ﬂicking techniques,
indicating the nonlinear part contributes more under such con-
dition. Moreover, what surprised us is that all of the values of
b are relatively small which implies that the linear part of the
model, b A
S , has very small impact upon the whole model. This
might be because that the nonlinear component whose expres-
sion includes the ratio A/S has incorporated most of the linear
aspects of the scrolling interaction. Thus we may consider ten-
tatively removing this term to yield a new simpler formulation
of the model
T = a + k log2
SαA/S +β
W (10)
As Table 5 shows, by evaluating this new model in a similar
approach as we did in the previous section, we found that it
achieves about the same performance as the original model,
which yielded similar R2 and AIC values in the regression anal-
ysis of both the whole task and the searching phase. Therefore
this version of the model may be preferred in practice because
it has fewer parameters.
6.3. Model and Factors
Since most of the time necessary to complete this scrolling
task is spent on the searching phase, in which the factors A and
S play a more important role, we choose to study how these two
factors affect the new model. According to Eq. (10), the move-
ment time T, if viewed as a function of S∈ (0,∞), has a single
Large A
Medium A
Small A
Figure 11: The relationship between movement time with parameters A and S .
maxima point which is determined by α,β, and A (Figure 11).
But Figure 5 shows that the time T decreases when S increases
for each technique. This implies that all of the sampled points
in this experiment fall in the region beyond the maxima point
towards inﬁnity. However, whether only this region is practical
for real data and tasks is still open for study.
Further, as shown in Figure 11, when the target distance A is
larger, the movement time drops down signiﬁcantly as the dis-
play window width S increases, whereas for smaller values of
A, the slope tends to change slowly. Therefore the model indi-
cates that the factor S affects the time less when A is smaller,
because fewer iterations are needed to reveal the target, and so a
larger window does not have a signiﬁcant impact on the whole
pointing task for smaller distances. Another interesting obser-
vation that we can make from the shape of the model is that
13

when S is really large the curves tend to be ﬂat, which means
the window width does not affect the movement time very much
when the window is extremely large. An extreme condition oc-
curs when the target is initially inside the display windows, in
this case time is not affected at all by the window width S .
6.4. Design Implications
From the experiment and the analysis of the results, we have
observed several factors that are likely to be of interest to inter-
action designers.
First, from the spread of Gaussians in Figure 6, we ﬁnd that
the participant is more varied at the end of scrolling and more
consistent at the beginning, because the variance for ﬁnger-
press positions (blue) is smaller than that for ﬁnger-release po-
sitions (red). Hence, especially in ﬂicking modes, designers
may consider adding tolerance to these loose ending positions.
For example, assign the same scrolling speed for strokes within
a speciﬁc range of lengths. Otherwise, the speed may change
abruptly for each operation if only simple mapping functions
are employed. This approach may improve the smoothness of
viewing the content during scrolling.
Second, it worths noting that the ﬁnger displacement remains
relatively constant around 200 pixels ( ≈ 12 cm) in ﬂicking
modes for screen sizes equal to or larger than S = 512 pixels
(≈ 30 cm), as shown in Figure 7. This distance could be the de-
sirable human ﬂicking distance. The participants tended to use
more space for panning. Hence, for large display windows, the
length of the stroke may indicate the user’s intention - quick ex-
ploration (ﬂicking) or carefully browsing (panning).Therefore
hybrid scrolling techniques that combine panning and ﬂicking
dynamically, adjusted to the behavior of the user, may be a good
choice for new designs.
Third, it is very interesting that there is a strong linear rela-
tionship between A/S and the number of iterations (Figure 9).
Therefore, techniques making this line ﬂatter, which means less
number of iterations at certain A/S , could signiﬁcantly speed
up the target acquisition. From the parameter ﬁttings of the
model (Table 1), we can see that such relationship is reﬂected
by the α parameter. Thus this parameter, coupled with of the
slope of the A/S versus the number of iterations curve, could
be one of the ways to evaluate, compare and further reﬁne the
scrolling techniques.
6.5. Limitations
As our work is the ﬁrst attempt to model user performance for
direct-touch scrolling under a multi-stage pointing paradigm,
there are several limitations in our current study which we aim
to address.
First, we notice that it is a fact that the ﬂicking implemen-
tation of most commercial devices has the friction simulation.
However, it is difﬁcult to select a baseline and representative
implementation to model because every device may have a dif-
ferent friction mechanism. And there is current no study in-
dicating which implementation is the best. Of the techniques
in our study, panning, in which the distance of the background
movement exactly equals users’ ﬁnger displacement, is a spe-
cial case of ﬂicking where the ﬂicking friction is inﬁnite; and
the multi-ﬂick-standard, in which the speed of the content after
ﬂicking is the same as the ﬂicking speed imposed by users, is
a kind of ﬂicking with zero friction. Because real-world im-
plementations lie in between these two extreme conditions, we
believe that our model is very likely to predict the movement
time under various types of ﬂicking techniques.
Similar for feedback techniques, in a real application, a user
may be able to get at least some information regarding the
target location, from off-screen visualization techniques, e.g.,
Halo (Baudisch and Rosenholtz, 2003), or the user’s familiarity
with the content or presentation methods of targets, e.g., ad-
dress books listed in alphabetical order and documents with an
outline or bookmark window. However, we also deal with two
extreme conditions for distance feedback: no distance feedback
and complete distance indication. In our experiment, partici-
pants had prior knowledge of the location of the target through
two means: direction indicated before scrolling and distance
feedback during scrolling. Thus, we believe that practical appli-
cations likely fall between the two target information extremes
we modeled, which were already veriﬁed in the experiment.
Third, in this paper, we only studied the horizontal direc-
tion of the 1D scrolling. Although on smaller devices such as
the iPhone, vertical scrolling seems to be more common. We
selected the horizontal setup as the original Fitts’ study (Fitts,
1954). Also, such conﬁguration allows us to investigate larger
range of the display window sizes on the Microsoft Surface.
Speciﬁcally, horizontal and vertical scrolling motion shares a
similar nature, in which a linear and repetitive multi-stage phys-
ical action is employed to accomplish motion toward the tar-
get. Moreover, the model would likely be applicable to lin-
ear 2D peephole pointing as well, so long as a similar interac-
tion framework was present. The effect of direction, i.e., angle,
upon 2D scrolling is left for future work.
Last, there might be some differences in user behaviors be-
tween our speciﬁc experimental conﬁguration (the Microsoft
Surface) and other touch-sensitive devices in our everyday life,
such as mobile phones and tablets. The way that the user holds
the devices, view angles, and display orientations may affect the
scrolling manipulations, which is different from the user stand-
ing by the tabletop to perform scrolling interactions off-hand.
Thus, future studies on such mobile devices are warranted to
further validate the model.
In short, our goal here is to provide a baseline model that
could be extended to model more complicated ﬂicking gestures
and scrolling tasks, like that the original Fitts’ law (Fitts, 1954)
which ﬁrst models the basic pointing and then is extended to
the area cursor cases (Kabbash and Buxton, 1995) and multi-
dimensional pointing (MacKenzie and Buxton, 1992; Gross-
man and Balakrishnan, 2004).
7. Conclusion and Future Work
In this paper, we presented an empirical study of scrolling
tasks on a touch-sensitive display. Based on four assumptions
drawn from the observation and analysis of user behaviors, we
proposed a quantitative model for the simpliﬁed and formal-
ized scrolling tasks. Then, an experiment was conducted to
14

validate this model under different scrolling and feedback tech-
niques. All of the assumptions have been supported by analyz-
ing the experimental data. Moreover, regression analysis indi-
cated that our model as well as its three critical components ﬁt
the data very well. We also compared our model to existing
models under two evaluation methods: traditional R2 measures
and AIC. The results showed that our model outperformed the
pre-existing models in many situations. Based on the ﬁtting re-
sults and discussions of the model factors, we proposed a new
model with fewer parameters but the same predictive perfor-
mance. Finally, we conducted in-depth discussions in many
aspects, including interpretations of the physical meanings of
model parameters and factors, a set of design guidelines gener-
alized from the experiment, and limitations of the current study.
As for future work, we ﬁrst aim to address the issues dis-
cussed in the limitations of this study. We plan to test our model
with other interaction techniques, further assuring its validity in
a wider application domains in the real-world. For example, we
would like to evaluate our model under other feedback tech-
niques such as speed-dependent auto-zooming (Igarashi and
Hinckley, 2000), and other scrolling techniques and friction
models (Aliakseyeu et al., 2008). Particularly, we aim to con-
duct more experiments, such as the alternative design described
in Section 4.5, to further validate some of the observations we
had and ensure the robustness of the model. We are also in-
terested in studying the user performance of acquiring 2D tar-
gets with 2D display windows involving multi-touch interaction
techniques such as zooming and rotating. Further, we plan to
experiment this model on mobile devices or wall-size displays
and with other input interfaces such as the stylus or the mouse.
Another interesting point to look at is that users may have time
delays in performing scrolling interactions due to mental pro-
cessing or choice reaction, which are not considered in our cur-
rent model. Thus a GOMS or KLM like model (Card et al.,
1980, 1983) could be constructed based on our formulation to
capture the various procedures in the user’s complex scrolling
and navigation behaviors.
Acknowledgment
We thank the volunteers who participated in our study and the
reviewers for their valuable comments. This study has been par-
tially supported by Grant-in-Aid for Scientiﬁc Research (No.
23300048) in Japan and NSFC of China (No. 61228206).
References
Accot, J., Zhai, S., 1997. Beyond ﬁtts’ law: models for trajectory-based hci
tasks. In: CHI’97: Proceedings of the SIGCHI conference on Human
factors in computing systems. pp. 295–302.
Akaike, H., 1974. A new look at the statistical model identiﬁcation. IEEE
Transactions on Automatic Control 19 (6), 716–723.
Aliakseyeu, D., Irani, P., Lucero, A., Subramanian, S., 2008. Multi-ﬂick: an
evaluation of ﬂick-based scrolling techniques for pen interfaces. In:
CHI’08: Proceedings of the SIGCHI conference on Human factors in
computing systems. pp. 1689–1698.
Andersen, T. H., 2005. A simple movement time model for scrolling. In: CHI
’05 extended abstracts. pp. 1180–1183.
Baudisch, P., Rosenholtz, R., 2003. Halo: a technique for visualizing
off-screen objects. In: CHI’03: Proceedings of the SIGCHI conference on
Human factors in computing systems. pp. 481–488.
Bi, X., Li, Y ., Zhai, S., 2013. Fﬁtts law: Modeling ﬁnger touch with ﬁtts’ law.
In: Proceedings of the SIGCHI Conference on Human Factors in
Computing Systems. CHI ’13. pp. 1363–1372.
Bishop, C. M., ???? Pattern Recognition and Machine Learning. Springer,
New York, NY , Ch. 9.2, pp. 430–439.
Burnham, K. P., Anderson, D., ???? Model Selection and Multimodel
Inference: A Practical Information-Theoretic Approach, 2nd Ed. Springer,
New York, NY , Ch. 6.4.5.
Burnham, K. P., Anderson, D. R., 2004. Multimodel inference: understanding
aic and bic in model selection. International Journal of Social Research
Methodology 33, 261–304.
Byrne, M. D., John, B. E., Wehrle, N. S., Crow, D. C., 1999. The tangled web
we wove: a taskonomy of www use. In: CHI’99: Proceedings of the
SIGCHI conference on Human factors in computing systems. pp. 544–551.
Cao, X., Li, J. J., Balakrishnan, R., 2008. Peephole pointing: modeling
acquisition of dynamically revealed targets. In: CHI’08:Proceedings of the
SIGCHI conference on Human factors in computing systems. pp.
1699–1708.
Cao, X., Zhai, S., 2007. Modeling human performance of pen stroke gestures.
In: Proceedings of the SIGCHI conference on Human factors in computing
systems. CHI ’07. ACM, New York, NY , USA, pp. 1495–1504.
Card, S., Moran, T. P., Newell, A., 1983. The Psychology of Human-Computer
Interaction. Lawrence Erlbaum Associates, Hillsdale, NJ.
Card, S. K., Moran, T. P., Newell, A., Jul. 1980. The keystroke-level model for
user performance time with interactive systems. Commun. ACM 23 (7),
396–410.
Casiez, G., V ogel, D., Balakrishnan, R., Cockburn, A., 2008. The impact of
Control-Display gain on user performance in pointing tasks.
Human-Computer Interaction 23 (3), 215–250.
Casiez, G., V ogel, D., Pan, Q., Chaillou, C., 2007. Rubberedge: reducing
clutching by combining position and rate control with elastic feedback. In:
UIST’07: Proceedings of the ACM symposium on User interface software
and technology. UIST ’07. pp. 129–138.
Cockburn, A., Gutwin, C., 2009. A predictive model of human performance
with scrolling and hierarchical lists. Human-Computer Interaction 24 (3),
273–314.
Cockburn, A., Quinn, P., Gutwin, C., Fitchett, S., 2012. Improving scrolling
devices with document length dependent gain. In: Proceedings of the 2012
ACM annual conference on Human Factors in Computing Systems. CHI
’12. ACM, New York, NY , USA, pp. 267–276.
Cockburn, A., Savage, J., Wallace, A., 2005. Tuning and testing scrolling
interfaces that automatically zoom. In: CHI’05: Proceedings of the
SIGCHI conference on Human factors in computing systems. pp. 71–80.
Fitts, P. M., 1954. The information capacity of the human motor system in
controlling the amplitude of movement. Journal of Experimental
Psychology 47, 381–391.
Fukutoku, F., Zhou, X., Ren, X., 2008. An evaluation of the maximal path
width for the steering law. In: Adjunct Proceedings of APCHI’08: 8th Asia
Paciﬁc Conference on Computer Human Interaction. pp. 116–118.
Grossman, T., Balakrishnan, R., 2004. Pointing at trivariate targets in 3d
environments. In: CHI’04: Proceedings of the SIGCHI conference on
Human factors in computing systems. pp. 447–454.
Grossman, T., Balakrishnan, R., 2005. A probabilistic approach to modeling
two-dimensional pointing. ACM Transactions on Computer-Human
Interaction 12 (3), 435–459.
Guiard, Y ., Beaudouin-lafon, M., 2004. Target acquisition in multiscale
electronic worlds. International Journal of Human-Computer Studies 61,
875–905.
Hinckley, K., Cutrell, E., Bathiche, S., Muss, T., 2002. Quantitative analysis of
scrolling techniques. In: CHI’02: Proceedings of the SIGCHI conference
on Human factors in computing systems. pp. 65–72.
Igarashi, T., Hinckley, K., 2000. Speed-dependent automatic zooming for
browsing large documents. In: CHI’00: Proceedings of the ACM
symposium on User interface software and technology. pp. 139–148.
Johnson, J. A., 1995. A comparison of user interfaces for panning on a
touch-controlled display. In: CHI’95: Proceedings of the SIGCHI
conference on Human factors in computing systems. pp. 218–225.
15

Kabbash, P., Buxton, W. A. S., 1995. The “prince” technique: Fitts’ law and
selection using area cursors. In: CHI’95: Proceedings of the SIGCHI
conference on Human factors in computing systems. pp. 273–279.
Kaptelinin, V ., 1995. A comparison of four navigation techniques in a 2d
browsing task. In: CHI’95: Proceedings of the SIGCHI conference on
Human factors in computing systems. pp. 282–283.
MacKenzie, I. S., Buxton, W., 1992. Extending ﬁtts’ law to two-dimensional
tasks. In: CHI’92: Proceedings of the SIGCHI conference on Human
factors in computing systems. pp. 219–226.
Malacria, S., Lecolinet, E., Guiard, Y ., 2010. Clutch-free panning and
integrated pan-zoom control on touch-sensitive surfaces: the cyclostar
approach. In: Proceedings of the 28th international conference on Human
factors in computing systems. CHI ’10. pp. 2615–2624.
McGufﬁn, M., Balakrishnan, R., 2002. Acquisition of expanding targets. In:
Proceedings of the SIGCHI Conference on Human Factors in Computing
Systems. CHI ’02. pp. 57–64.
Mehra, S., Werkhoven, P., Worring, M., 2006. Navigating on handheld
displays: Dynamic versus static peephole navigation. ACM Transactions on
Computer-Human Interaction 13 (4), 448–457.
Quinn, P., Malacria, S., Cockburn, A., 2013. Touch scrolling transfer
functions. In: Proceedings of the 26th Annual ACM Symposium on User
Interface Software and Technology. UIST ’13. pp. 61–70.
Reetz, A., Gutwin, C., Stach, T., Nacenta, M., Subramanian, S., 2006.
Superﬂick: a natural and efﬁcient technique for long-distance object
placement on digital tables. In: GI’06: Proceedings of Graphics Interface.
pp. 163–170.
Ren, X., Kong, J., Jiang, X., 2005. Sh-model: A model based on both system
and human effects for pointing task evaluation. The Information Processing
Society of Japan 46 (5), 1343–1353.
Rohs, M., Oulasvirta, A., 2008. Target acquisition with camera phones when
used as magic lenses. In: CHI’08: Proceedings of the SIGCHI conference
on Human factors in computing systems. pp. 1409–1418.
Soukoreff, R. W., MacKenzie, I. S., December 2004. Towards a standard for
pointing device evaluation, perspectives on 27 years of ﬁtts’ law research in
hci. International Journal of Human-Computer Studies 61, 751–789.
Yee, K.-P., 2003. Peephole displays: pen interaction on spatially aware
handheld computers. In: CHI’03: Proceedings of the SIGCHI conference
on Human factors in computing systems. pp. 1–8.
Zhai, S., Smith, B. A., Selker, T., 1997. Improving browsing performance: A
study of four input devices for scrolling and pointing tasks. In: INTERACT
’97: IFIP TC13 Interantional Conference on Human-Computer Interaction.
pp. 286–293.
Zhao, J., Soukoreff, R. W., Balakrishnan, R., 2011. A model of multi-touch
manipulation. In: Proceedings of the Grand conference.
16

Appendix A. Complete Model Fitting Results
Iteration Technique a b R 2
(ms) (ms/bit)
Titeration = a + b log2 S
PNF -690 148 0.98
PF -644 140 0.96
FNF -301 107 0.87
FF -310 106 0.92
Searching phase Technique a b c α R2
(ms) (ms) (ms/bit) R2
T search = a + b A
S + c log2 Sα A
S +1
PNF 915 0.001 93.8 0.557 0.97
PF 950 0.004 92.0 0.658 0.98
FNF 770 0.002 153 0.393 0.97
FF 865 0.007 142 0.466 0.98
Pointing phase Technique a b R 2
(ms) (ms/bit)
T point = a + b log2
S
W
PNF 285 166 0.94
PF 350 148 0.85
FNF 386 210 0.86
FF 373 230 0.94
Table A.6: Fitting results of the three basic models components under different techniques.
Long form model Technique a b c d e R 2
(ms) (ms) (ms/bit) (ms/bit) (ms/bit)
T = a + b A
S + c log2 S + d A
S log2 S + e log2
S
W
PNF -3078 -470 383 148 144 0.98
PF -2939 -429 383 137 143 0.98
FNF -3192 -325 412 127 309 0.98
FF -2558 -312 339 111 244 0.97
Long form model in searching phase Technique a b c d R 2
(ms) (ms) (ms/bit) (ms/bit) R2
T search = a + b A
S + c log2 S + d A
S log2 S
PNF -3120 -486 343 151 0.97
PF -3095 -488 348 146 0.98
FNF -4575 -411 485 139 0.97
FF -2656 -354 316 116 0.98
Table A.7: Fitting results of the long forms of the model under different techniques.
17

Our model I Technique a b k α β R2 AIC
(ms) (ms) (ms/bit)
T = a + b A
S + k log2
SαA/S +β
W
PNF 2.36 0.002 175 0.395 1.65 0.98 546
PF -1.36 0.003 172 0.370 1.72 0.98 540
FNF -5.36 0.002 243 0.264 1.39 0.97 559
FF -6.54 0.001 271 0.211 1.39 0.97 533
Our model II Technique a k α β R2 AIC
(ms) (ms) (ms/bit)
T = a + k log2
SαA/S +β
W
PNF 2.48 176 0.411 1.67 0.96 568
PF -2.36 173 0.382 1.71 0.97 550
FNF -6.34 242 0.268 1.39 0.97 556
FF -5.52 269 0.223 1.38 0.96 542
Two-part Fitts’ law I (Cao et al., 2008) Technique a b n R 2 AIC
(ms) (ms/bit)
T = a + b(n log2( A
S + 1) + (1− n) log2( A
W + 1))
PNF -1357 2104 0.872 0.90 613
PF -1049 1918 0.862 0.90 606
FNF -1908 2069 0.789 0.87 618
FF -890 1702 0.792 0.88 598
Two-part Fitts’ law II (Rohs and Oulasvirta, 2008) Technique a b c R 2 AIC
(ms) (ms/bit) (ms/bit)
T = a + b log2( A
S + 1) + c log2( S
2W + 1)
PNF -1864 2219 379 0.91 609
PF -1548 2030 373 0.90 601
FNF -2530 2218 577 0.89 612
FF -1378 1820 466 0.89 593
Multi-scale model (Guiard and Beaudouin-lafon, 2004) Technique a k R 2 AIC
(ms) (ms ·pixels/bit)
T = a + k
S log2( A
W + 1)
PNF 2606 10623 0.82 641
PF 2647 95780 0.81 634
FNF 2671 97939 0.81 636
FF 2865 80453 0.80 618
Clutch model (Casiez et al., 2007) Technique a b c T c R2 AIC
(ms) (ms/bit) (ms) R2 AIC
T = 2Tc⌊ A
cS⌋ + a + b log2( A−cS⌊A/cS⌋
W + 1)
PNF 396 454 1.962 565 0.80 651
PF 476 373 2.286 551 0.91 602
FNF 256 542 2.268 602 0.92 593
FF 387 505 2.399 588 0.84 613
Table A.8: Fitting results of our model and its alternative form as well as comparisons with other models under different techniques using R2 and AIC.
18

Our model I Technique a b c α R2 AIC
(ms) (ms) (ms/bit)
T search = a + b A
S + c log2 Sα A
S +1
PNF 915 0.001 93.8 0.557 0.97 540
PF 950 0.004 92.0 0.658 0.98 552
FNF 770 0.002 153 0.393 0.97 557
FF 865 0.007 142 0.466 0.98 552
Our model II Technique a k α R2 AIC
(ms) (ms) (ms/bit)
T search = a + k log2(SαA/S )
PNF 865 69.0 0.955 0.98 550
PF 950 87.7 0.690 0.98 538
FNF 770 228 0.264 0.97 555
FF 915 125 0.418 0.97 538
Two-part Fitts’ law Technique a b R 2 AIC
(ms) (ms/bit)
T search = a + b log2( A
S + 1)
PNF 915 0.001 0.82 610
PF 950 0.004 0.82 604
FNF 770 0.002 0.80 614
FF 865 0.007 0.82 592
Clutch model Technique c T c R2 AIC
(ms)
T search = 2Tc⌊ A
cS⌋
PNF 1.781 565 0.59 692
PF 1.815 551 0.50 694
FNF 1.941 602 0.54 689
FF 2.316 588 0.35 692
Table A.9: Fitting results of our model and its alternative form in the searching phase as well as comparisons with other similar models under different techniques
using R2 and AIC.
19