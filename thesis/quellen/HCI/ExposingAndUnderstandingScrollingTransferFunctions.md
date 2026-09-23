# ExposingAndUnderstandingScrollingTransferFunctions

Quelle: C:\Users\Felix\Desktop\Master\Thesis\Quellen\HCI\ExposingAndUnderstandingScrollingTransferFunctions.pdf

---
Exposing and Understanding Scrolling Transfer Functions
Philip Quinn1 Andy Cockburn1 Géry Casiez2,3,4 Nicolas Roussel3 Carl Gutwin5
1University of Canterbury
Christchurch, New Zealand
philip.quinn@canterbury.ac.nz
andy@cosc.canterbury.ac.nz
2LIFL, 3INRIA Lille &
4University of Lille
Villeneuve d’Ascq, France
gery.casiez@liﬂ.fr
nicolas.roussel@inria.fr
5University of Saskatchewan
Saskatoon, Canada
gutwin@cs.usask.ca
ABSTRACT
Scrolling is controlled through many forms of input devices,
such as mouse wheels, trackpad gestures, arrow keys, and
joysticks. Performance with these devices can be adjusted
by introducing variable transfer functions to alter the range
of expressible speed, precision, and sensitivity. However, ex-
isting transfer functions are typically “black boxes” bundled
into proprietary operating systems and drivers. This presents
three problems for researchers: (1) a lack of knowledge about
the current state of the ﬁeld; (2) a difﬁculty in replicating
research that uses scrolling devices; and (3) a potential ex-
perimental confound when evaluating scrolling devices and
techniques. These three problems are caused by gaps in re-
searchers’ knowledge about what device and movement fac-
tors are important for scrolling transfer functions, and about
how existing devices and drivers use these factors. We ﬁll
these knowledge gaps with a framework of transfer function
factors for scrolling, and a method for analysing proprietary
transfer functions—demonstrating how state of the art com-
mercial devices accommodate some of the human control
phenomena observed in prior studies.
Author Keywords
Control-display gain; scrolling; scroll acceleration; transfer
functions.
ACM Classiﬁcation Keywords
H.5.2 [Information interfaces and presentation]: User inter-
faces – Input devices and strategies.
INTRODUCTION
Scrolling is an essential task in modern computing, and
scrolling devices such as mouse wheels and trackpad ges-
tures are ubiquitous. A fundamental element of scroll control
that all techniques must address is the transfer function that
maps the user’s actions with the input device (for example,
degrees of rotation, millimetres of displacement, or newtons
of force) into scrolling movement of the display (typically
either pixels, lines, or pages). However, there has been sur-
Permission to make digital or hard copies of all or part of this work for
personal or classroom use is granted without fee provided that copies are
not made or distributed for proﬁt or commercial advantage and that copies
bear this notice and the full citation on the ﬁrst page. To copy otherwise, to
republish, to post on servers or to redistribute to lists, requires prior speciﬁc
permission and/or a fee.
UIST’12,October 7–10, 2012, Cambridge, Massachusetts, USA.
Copyright 2012 ACM 978-1-4503-1580-7/12/10...$15.00.
prisingly little public research on scrolling transfer functions.
Notable exceptions include Hinckley et al. [15] and Cock-
burn et al. [11], but even these studies are ambiguous about
the exact functions used or tested—for example, Hinckley
et al. stated “We tested the device using the manufacturer’s
default settings”, but precisely determining the correspond-
ing transfer function is now near impossible; Cockburn et al.
explicitly acknowledged the need for further research to un-
derstand the role that the system transfer function may have
played in their experiment.
The poor understanding of scrolling transfer functions cre-
ates several problems for researchers. First, existing meth-
ods are unknown because they are embedded in ‘black box’
driver code, making it difﬁcult for researchers to understand
the cause of performance differences between devices, or to
iteratively improve on the state of the art. Second, replication
of scrolling studies is frustrated by ambiguities in experimen-
tal settings—researchers lack the tools to examine, report,
and replicate transfer functions. Third, researchers may in-
advertently introduce confounds into experiments stemming
from unknown interactions between particular transfer func-
tions and their experimental treatment.
Casiez and Roussel [8] recently observed similar problems of
“bricolage” in research treatment of pointing transfer func-
tions. To address the problem, they developed an electronic
device called EchoMouse to probe and inspect transfer func-
tions. They also created a software library called libpointing
that implemented these functions for experimental replica-
tion. They used these components to simulate human mouse
control at a variety of physical input movement speeds, and
to inspect the resultant system response.
Although EchoMouse and libpointing provide critical hints
on how to examine scrolling transfer functions, the map-
ping from input actions to output effects is more complex
for scrolling. While pointing transfer functions attend to two
parameters (mouse velocity and user setting), scrolling func-
tions are likely to attend to many more. Multiple parame-
ters are necessary (or advisable) because of the paucity of
scrolling input mechanics. For pointing, a modern mouse
will register thousands of points per inch, and it can be
moved across a two-dimensional area of several inches with-
out clutching (physically disengaging input control in or-
der to reposition a limb to repeat the action); in contrast,
a typical scroll wheel can only be moved through ﬁve or
six detents/notches across ~40◦ of one-dimensional rotation
341

between clutching actions; and the muscle groups used to
control wheel rotation (ﬁnger extensors and contractors) are
likely to induce different control capabilities across scroll di-
rections. Scrolling transfer functions, therefore, are likely
to attend to input parameters that include the rate of device
movement, time between clutched repetitions, scroll direc-
tion, and more. But whether they do this, and how they do it,
is currently unknown.
These physical and operational characteristics of devices,
and the human capabilities when operating them, have clear
implications for the design of scrolling transfer functions. To
help understand these issues, the following section presents
a framework of the factors inﬂuencing scroll control. We
then reverse engineer the scrolling transfer functions in state
of the art commercial scroll drivers, and conﬁrm that some
drivers attend to many input parameters, while others are
based purely on the velocity of input control.
FACTORS INFLUENCING SCROLL CONTROL
There has been extensive prior work on taxonomies that aid
in understanding the design space of input devices, which we
draw on to organise the physical characteristics of scrolling
devices. Buxton’s [4] early taxonomy organised devices by
their physical properties—position, motion, or pressure—
and by the number of dimensions along those properties that
are sensed. Mackinlay et al. [20] and Card et al. [6, 7]
expanded this into a morphological analysis, placing de-
vices as points in a parametrically described design space
that included the eight combinations of linear/rotary, abso-
lute/relative, and position/force across six linear and rota-
tional dimensions. They also composed chains of connec-
tions between the physical parameters and the semantics of
an application. Buxton [5] and Hinckley and Sinclair [16] ex-
panded this classiﬁcation to include devices that operate by
touch (rather than a mechanical control), and Lipscomb and
Pique [19] added several dimensions of physical device char-
acteristics (including the behaviour of the movement axes,
bounds of movement, and self-zeroing behaviour).
These taxonomies can be used to classify the physical sens-
ing properties of scrolling devices; for example, that mouse
wheels are single-axis rotary controls that sense discretised
changes in rotation, or that trackpads sense absolute one or
two-dimensional position. They can also classify the features
of the physical controls used to input these properties; for ex-
ample, mouse wheels can rotate in rigid, discrete detents, or
the detents can be soft and the wheel can be inertial (sup-
plying sensor data without active user interaction). These
design choices promote different methods of interacting with
the device in different scrolling scenarios (for instance, rapid
clutching on a discrete wheel vs. ﬂicking and inertial one),
and consequently inﬂuence the range and type of inputs that
are likely to be received. However, the input parameters that
are derived from these different methods of interaction are
not captured by the above taxonomies.
This section presents a framework for the factors inﬂuencing
scrolling behaviour and prior scrolling research. The frame-
work is organised across considerations of input parameters,
a review of the system-oriented view of scrolling, and prior
studies of scrolling gain.
Input Parameters
While these taxonomies organise the physical characteristics
of scrolling devices, they do not focus on how features of the
manipulation can be translated into task-speciﬁc semantics.
Despite the apparent simplicity of scrolling as uni-
dimensional translation, there exists a broad variety of de-
vices to support it, each of which may use a multitude of in-
put parameters for inferring the user’s scrolling intention. For
example, a mouse wheel senses discretised rotary motion, but
the user’s intention may be inferred from any combination of
the following: (1) the degrees of rotation; (2) the speed of ro-
tation; (3) the rate of change in the speed of rotation; (4) the
duration of interaction; (5) the direction of interaction; and
(6) the period of interaction.
In general, actions performed on a device need to be mapped
from a physical manipulation to an interface command. In
doing so, several input parameters can be considered, in-
creasing expressivity. For example, keyboard arrow buttons
are a one-dimensional discrete control, but their use may be
interpreted through continuous parameters such as duration
of activation or the rate of repetition. These additional in-
put channels can be classiﬁed into three types: measures of
instantaneous action, measures of action duration, and cu-
mulative/relative measures, described below.
Instantaneous measures. Measures of instantaneous action
are the physical properties that are sensed by a device or their
derivatives from samples over time. For example, spinning
a detented mouse wheel produces discrete events of rota-
tional movement; however, sampling several events produces
new input parameters of angular velocity, acceleration, and
higher-order derivatives.
These measures may alter the interpretation or mapping of
the original property. For example, increasing mouse wheel
velocity or acceleration may be used to increase the mag-
nitude of scrolling events generated from the input of each
wheel event, or may be used as a signal to switch between
scrolling modes (such as between line and page-scrolling).
Action duration. The duration that an input is maintained
(or is absent) can also serve as an input to a transfer func-
tion. For example, if a key or button is held down for more
than a certain duration, it may start issuing repeating events
at an increasing rate. Similarly, if scrolling velocity is main-
tained above a certain level, then gain might increase with
the assumption that the user wants to travel a long distance.
Cumulative and relative inputs. Input measures may also
have a memory of prior actions to determine resultant effects.
For example, Hinckley and Cutrell [17] described a scrolling
transfer function that cumulatively adds gain across rapidly
repeated wheel rotations in the same direction; the cumula-
tive effect is cancelled if the user pauses too long or reverses
direction. Similarly, rate-based scrolling controls scroll ve-
locity using the relative position of the input device with re-
spect to an anchor point set at the action’s initiation.
The System’s Perspective
Figure 1 depicts the conceptual transformations that form
a transfer function’s behaviour in converting human action
342

Translation
Gain
Persistence
Transfer Function
Device
Input
Scrolling
Output
User 
Settings
Device Units
Display Units
Figure 1: Depiction of the conceptual transformations
occurring in a scrolling transfer function.
at the device into resultant display modiﬁcation in scrolling.
Not all of these transformations may be present in any trans-
fer function: some may be absent, some may be combined,
and some may be applied multiple times in different compo-
nents (for example, gain applied by a driver and again by a
UI toolkit or application).
Translation converts the device’s physically registered events
(degrees of rotation, newtons of force, millimetres of dis-
placement, etc.) into units that are comprehensible to the
system, such as pixels, lines, or pages. Users may be able to
adjust this translation, either through controls on the device,
or via a user interface on the system.
A gain function may then amplify or attenuate the control
signal: for example, to allow slow precise control when the
device is manipulated slowly, as well as accelerated scrolling
when it is manipulated more aggressively. When gain is sup-
ported, users are commonly able to conﬁgure its setting.
Finally, a persistence component allows for a history of in-
put and calculated parameters (such as input velocity and ac-
celeration) to be preserved, or to allow for effects that are
applied across time (such as cumulative effects, inertia, and
simulated friction). Data from the persistence component can
be used as input into the translation (e.g., allowing a switch
from pixel to line scrolling if manipulation is continued for
a threshold time), or into the gain (e.g., applying cumulative
gain across repeated scroll wheel clutches). Finally, the user
may be able to conﬁgure parameters of the persistence com-
ponent (e.g., altering the degree of inertia or friction).
Most scrolling devices conform to the Human Interface De-
vices (HID) class of the USB standard [3]. The HID class
provides a common, vendor-independent method for com-
municating interaction data from common types of devices to
a computer system. Devices that implement the appropriate
HID usage tables (for example, mice, keyboards, phones, and
digitisers [2]) can operate without vendor-speciﬁc drivers, al-
lowing a high degree of device/application interoperability.
HID devices report extensive descriptions of their sensing
and reporting characteristics to the operating system/driver
via HID descriptors. Of particular interest to scrolling are
the wheel report range (typically 8-bit values interpreted to
be between −127 and +127, but any size or range may
be chosen by a manufacturer), the characteristics of the re-
port (absolute/relative, wrapping/non-wrapping, linear/non-
linear, etc.), and the rate at which reports are sent. The res-
olution and units of these reports can also be speciﬁed, but
none of the devices we examined did so. System-speciﬁc
extensions may also exist. For example, starting with Win-
dows Vista, Microsoft allows devices to support horizontal
scrolling and high-resolution scrolling by reporting a resolu-
tion multiplier and responding to queries from the operating
system to conﬁgure it [21].
While most of the scrolling devices we examined supplied a
‘Wheel’ HID usage, notable exceptions to this were track-
pads that used conﬁgurable gestures to enable a scrolling
mode (for example, Apple’s laptop trackpads and Magic
Trackpad1). These devices transmit information about the
gestures through proprietary data ﬁelds in the HID report,
and rely upon manufacturer-speciﬁc drivers to interpret them
and report scroll events to the operating system.
Despite the vendor-independent nature of the HID speciﬁ-
cation, drivers from device manufacturers may still play a
signiﬁcant role in deﬁning the device’s scrolling behaviour
by attending to the input parameters discussed previously
(and may be necessary to make exotic hardware that has not
been anticipated by the HID usage tables useful at all—for
example, trackpad scrolling gestures). Some of these fea-
tures may include scrolling horizontally, independent trans-
fer functions for each direction to match human capabili-
ties, conﬁgurable buttons or gestures to augment or change
scrolling behaviour/resolution, or different scrolling modes
for each application. For example, the Logitech MX Revolu-
tion2 features a weighted, low-ﬁction wheel that can have
ratchets automatically engaged by the drivers as a user’s
scrolling behaviour changes.
Prior Studies of Scrolling Gain
In an early scroll wheel description, Gillick et al. [12, 13]
described a potential transfer function that treats initial wheel
events as line-scrolling, and advanced to page-scrolling once
events passed a certain threshold-rate. A similar technique
was recently described by Montalcini [22].
Hinckley et al. [15] describe a scroll transfer function that
operates on the calculated interval between events received
from the scrolling device/driver:
1http://apple.com/magictrackpad/
2http://logitech.com/428/130
343

∆y = K1(1 + K2∆t)α
Where K1, K2, and α are constants, ∆t is the interval be-
tween subsequent events, and ∆y is the resulting scale factor
to apply to reported magnitudes. Hinckley et al. evaluated
their function when applied to a driver reporting three lines
of scrolling per physical detent, one line per detent, a “stan-
dard” three lines per detent without application of the func-
tion, and an IBM ScrollPoint (isometric joystick; the conﬁg-
uration parameters of which are not reported) in a repeated
tapping task. They found comparable or signiﬁcantly better
performance when using the accelerated functions.
Two further enhancements are detailed in related patents [17,
and related continuity data]. One is a feature that detects
changes in the scroll direction and temporarily inhibits the
application of ∆y—aiming to prevent ampliﬁcation of over-
shooting errors. The other identiﬁes rapidly repeated clutch-
ing of the wheel (in an attempt to travel a long distance) and
applies cumulative gain according to the number of succes-
sive wheel ﬂicks (Nﬂicks):
Zscroll = ∆y· G0· GF· Nﬂicks
Where G0 is the baseline number of lines to scroll per detent,
GF is the additional amount of gain to apply per ﬂick, and
Zscroll is the number of lines to scroll.
Kobayashi and Igarashi [18] explored the use of the cursor
position as an input parameter to a dynamic transfer function.
Their MoreWheel technique combines absolute and relative
scrolling into the scroll wheel: dragging the mouse with the
wheel depressed simulates grabbing the scroll thumb and en-
ables absolute scrolling, while spinning the wheel produces
either line or page-scrolling depending on the position of the
cursor within the window (for example, line scrolling when
the cursor is in the middle of the window, transitioning to
page scrolling near the top or bottom edges).
Cockburn et al. [11] describe a method where two transfer
functions are transitioned between based on the velocity of
the scroll input to enable slow scrolling at a rate akin to
Hinckley et al. [15], and rapid scrolling based on a function
that utilises information about the length of the document
being scrolled. The velocity of incoming scroll events is cal-
culated, smoothed, and used to determine the proportion of
each transfer function to apply:
g =
[
p·
(
ks− ksα−v)]
+
[
(1− p)·
(
k f
document length
viewport size
)]
Where ks, k f , and α are constants, v is the reported input
velocity, p is the proportion of the “slow” function to ap-
ply (determined by examining the relationship of v to the
user’s maximum velocity), and g is the resulting scale fac-
tor to apply to reported magnitudes. An evaluation of this
function using two wheel-based devices and an isometric
joystick against the “additive ﬂicking” technique of Hinck-
ley and Cutrell [17] found it to perform signiﬁcantly faster
for long documents.
The above studies have explicitly examined the impact of
scrolling transfer functions, but there are many more stud-
ies that have examined scrolling with imprecise and non-
replicable transfer functions. This is not a criticism of the
studies, but rather an unfortunate state of affairs—there has
been a lack of tools supporting rigour around scrolling trans-
fer functions. Some studies evaluate scrolling systems with-
out mentioning the gain levels or transfer function used [e.g.,
10, 14, 23]; some explicitly state the absence of acceleration,
but do not state the constant translation used [e.g., 9]; and
others rely on the default settings without stipulating what
behaviour results [e.g., 1, 24].
REVERSE ENGINEERING CURRENT
SCROLLING TRANSFER FUNCTIONS
To examine commercial scrolling transfer functions, we used
a modiﬁed version of the EchoMouse [8]: a programmable
microcontroller that allowed us to transmit scrolling events
to the system in a controlled and systematic manner, emulat-
ing an ordinary scrolling device. To inspect the functions in-
side a particular device driver, the EchoMouse was modiﬁed
to present itself as a compatible device from the appropriate
manufacturer by manipulating its reported HID vendor and
product identiﬁers. Therefore, by triggering the EchoMouse
to emit scrolling events in a pre-deﬁned pattern, and inspect-
ing the scrolling events received by a user application, we
can examine how the original events have been transformed.
We tested the scrolling drivers found in Apple Mac OS X
10.7.3, Microsoft Windows 7 (SP1), Microsoft IntelliPoint
(8.20.468 on Windows), Logitech SetPoint (driver 5.33.14
on Windows), and Logitech Control Center (3.5.1-23 on Mac
OS X)—these represent some of the most popular operat-
ing systems and device manufacturers. With each driver, we
impersonated the characteristics of several representative de-
vices that they supported to gather data (testing low and high-
resolution devices, although no differences between devices
was found). The Mac OS X and Windows 7 drivers rep-
resent generic drivers that are used by the operating system
when no vendor-speciﬁc drivers are available. We did not test
the Mac OS X version of Microsoft’s IntelliPoint driver as it
conﬂicted with our EchoMouse control software, nor did we
test an X11 environment as pilot testing showed that it (xorg
1.11.4-2; Fedora 16) does not implement scroll acceleration
(the interpretation of each count is left to individual UI toolk-
its or applications).
This section presents an analysis of the publicly available
information about these functions, followed by the testing
methodology that we used to gather data about their embed-
ded transfer functions.
Analysis of Existing Transfer Functions
Apple Mac OS X. Apple release several of their low-
level input processing frameworks under an open source li-
cence, including those for HID devices. Within the IO-
HIDFamily framework3 (version 368.20, corresponding to
Mac OS X 10.7.3 was examined for this study), the IO-
HIDFamily/IOHIDPointing.cpp and IOHIDSystem/IO-
3http://opensource.apple.com/source/IOHIDFamily/
344

(a) Mac OS X.
(b) Microsoft IntelliPoint (Windows).
(c) Logitech Control Center (Mac OS X).
Figure 2: User interfaces for conﬁguring scroll control.
HIPointing.cpp source ﬁles contain much of the code per-
tinent to pointing (and by extension, scrolling) devices.
Drivers can supply an encoded table of acceleration lines
(slopes m and intercepts b) to be applied at different in-
put magnitudes; these lines are scaled based on the user’s
scrolling speed setting (detailed below). When a scroll event
is received with magnitude y, it is added to a smoothing win-
dow of the last eight events to avoid rapid changes in gain.
The average time delta between events in the smoothing win-
dow ∆t and average unaccelerated magnitudes y is then used
to calculate a threshold:
l =
[
(Ka· ∆t
2
)− (Kb· ∆t) +Kc
]
· r· y
Where Ka, Kb, and Kc are constants, and r is an input rate
multiplier (1 by default). 4 An acceleration line appropriate
for an input magnitude larger thanl is selected from the table,
and applied:
y′ = y· b + (l· m)
|y|
The control exposed to users for this function is a slider in
the system preferences to manipulate “Scrolling Speed” with
eight intervals from “Slow” to “Fast” (shown in Figure 2(a)),
and a corresponding API (IOHID[Get/Set]ScrollAccel-
eration(), where the notches on the slider are mapped to
the API values {0, 0.12, 0.31, 0.5, 0.69, 0.88, 1, 1.7}). An in-
teresting feature of this control is that a negative value (which
can only be selected via the API) completely disables scroll
acceleration for generic devices, or engages a page-scrolling
mode for an Apple trackpad.
Drivers can report scrolling events in units of either lines or
pixels, with an automatic conversion by the system between
them of 10 pixels per line. We report output in pixels to
match the reports given by the system to user applications.
4Code also exists for scaling these functions with the screen resolution, but
the calculations are currently ﬁxed.
It should be stressed that the behaviour described above is
the default that is applied should no better drivers match a
connected device. Manufacturers are free to use and adjust
the described behaviour in part, or as a whole. For example,
Apple’s closed-source driver for their laptop trackpads sup-
plies a scrolling acceleration table that can be decoded with
the source code provided, but that alone does not guarantee
that it will be applied in the manner described above.
Microsoft Windows. Windows provides scrolling informa-
tion to applications via WM_MOUSEWHEEL messages with a
parameter indicating the distance the wheel has been rotated
in units of WHEEL_DELTA. These values are intended to be
scaled by the user setting SPI_GETWHEELSCROLLLINES, in-
dicating how many lines to scroll per unit of WHEEL_DELTA
(or, a special value indicating that each unit should be in-
terpreted as a page scroll). The interpretation of “lines” or
“pages” is left to the application receiving the message. On
all current systems, WHEEL_DELTA is set to 120, which al-
lows high-resolution devices to indicate scrolling of frac-
tional lines.5 We report the output from drivers running un-
der Windows in “lines” (i.e. units ofWHEEL_DELTA).
Microsoft IntelliPoint. Microsoft’s IntelliPoint drivers for
their branded devices presents two controls for the user
to conﬁgure the scrolling transfer function (shown in Fig-
ure 2(b)). The ﬁrst controls SPI_GETWHEELSCROLLLINES
in the range [1, 40]; the second is a seven-interval slider to
control accelerated scrolling from “slow” to “fast” (with an
option to disable it entirely).
Logitech. Logitech produces two driver packages for their
devices: SetPoint for Windows, and Control Center for Mac
OS X. The conﬁguration options and range of supported de-
vices differs between these packages; in particular, SetPoint
provides options to conﬁgure SPI_GETWHEELSCROLLLINES
for line or page scrolling but with no options for acceleration,
5http://msdn.microsoft.com/library/ms997498
345

while Control Center allows customisation of the scrolling
“speed” (from “slow” to “fast”) and “acceleration” (from
“none” to “max”), as shown in Figure 2(c) (both of these are
continuous sliders, but were tested at the marked intervals).
Testing Methodology
Scrolling events from the EchoMouse have values in the
range−127 to +127. We observed that reports from de-
vices were typically either −1 (scroll down) or +1 (scroll
up) with wider values used when the physical manipulation
of the device exceeded its HID input report rate (typically
100~125Hz, but high-end devices may report at rates up to
1000Hz); we emulated this behaviour.
A potential issue when impersonating other devices is match-
ing their input resolution. While the USB HID speciﬁcation
allows devices to specify the resolution and physical units of
their input, none of the device we tested did so. For instance,
a Microsoft Wheel Mouse Optical 6 sends 18 scroll counts
per complete revolution of its wheel (20◦ per detent), while
a Logitech MX500 7 sends 24 (15◦ per detent), but their re-
ports are indistinguishable to a generic driver (similar issues
exist for trackpads that transmit events corresponding to mil-
limetres of displacement, or other types of physical control).
Because we tested a range of devices with different input res-
olutions, we report our input velocity in “counts” per unit
of time, where one count corresponds to one scroll event of
magnitude−1 or +1 (issues surrounding device resolution
are discussed later).
As we are interested in the various input parameters that
transfer functions may attend to (and not only how they oper-
ate under levels of velocity), we performed four mechanised
tests of each possible conﬁguration of driver and device:
• Constant velocity: emulating a constant speed of device
operation for ﬁve seconds, and measuring the resultant out-
put scrolling velocity as an average over that period.
• Maintained velocity: emulating a constant speed of device
operation for ﬁve seconds, and measuring the resultant out-
put scrolling velocity for each event.
• Clutching: we emulated clutching actions, manipulating
the speed of device operation, the duration of clutches, and
the time between successive clutches.
• Direction changes: we emulated direction changes (al-
ternating between scrolling up and scrolling down) while
maintaining a constant speed of device operation.
These tests were repeated for each conﬁguration option pre-
sented to users (as described above), and across a range of
possible user control input rates. Custom software moni-
tored the system’s response using the low-level event report-
ing APIs provided by each operating system (free from po-
tential manipulation by higher-level frameworks or toolkits).
RESULTS AND ANALYSIS
The results of our analyses are summarised in Table 1. We
found that neither Microsoft Windows 7, nor Logitech’s Set-
Point drivers provide any scroll acceleration (the gain is
always constant). Due to the large number of conﬁgura-
6http://microsoft.com/hardware/en-nz/d/
wheel-mouse-optical
7http://logitech.com/428/910
V
elocityDirectionDurationClutching
Apple Mac OS X  G # # G #
Microsoft Windows 7 # # # #
Microsoft IntelliPoint   #  
Logitech SetPoint # # # #
Logitech Control Center  G #  #
Table 1: Summary of the tested drivers’ attendance to
tested input features—#: no attendance, : attendance,
G #: partial attendance (details in text).
tions tested and the many commonalities discovered between
them, the following subsections present a survey of the most
salient and interesting behaviour characteristics and parame-
ters attended to (a complete spreadsheet of the acceleration
tables collected is also available 8). Following the main re-
sults, we summarise device-speciﬁc issues in the analysis.
Gain with Respect to Velocity
How the different systems alter gain across input velocity is
shown in Figures 3(a), (b), and (c) for Mac OS X, Microsoft
IntelliPoint, and Logitech Control Center, respectively. The
multiple lines in each ﬁgure show different levels of user set-
ting for scrolling “speed” (Mac OS X, Figure 2(a)) or scroll
“acceleration” (Microsoft IntelliPoint and Logitech Control
Center, Figures 2(b) and (c)). The solid and dashed lines in
Figure 3(b) differentiate between scrolling direction (up and
down); the other drivers respond to both directions equally.
The maximum attainable scale factors range from ~14×with
Mac OS X, to ~18× with Logitech, and ~21× with Intelli-
Point. The key differences between the three curve shapes is
that Logitech’s curves for high acceleration show a dramatic
drop in gain after peaking at 18 × at ~28 counts/s. This is
a result of a falling (but still positive) gradient in the output
velocity curve; however the rationale for this design choice
is unknown. Both Mac OS X and Logitech allow input to be
attenuated (with a gain of less than 1) at low input speeds,
increasing the expressivity of devices with poor resolution.
Direction as an Input
Figure 3(b) shows that Microsoft IntelliPoint drivers apply
differing gain levels across each scrolling direction. This is
probably applied to compensate for the differing maximum
input velocities attainable in the two directions (Cockburn
et al. [11] showed marked differences between maximum
scroll wheel rotation speeds upwards and downwards).
Mac OS X and Logitech drivers do not vary gain across di-
rection, but directional changes do momentarily “reset” gain,
as shown for Mac OS X in Figure 6(a). This is due to a reset
of the smoothing window upon direction change, resulting
in reduced gain until the window is re-ﬁlled. The same task
with Microsoft’s IntelliPoint drivers is shown in Figure 6(b),
where we observed a very brief drop in gain and the applica-
tion of different levels of gain for each direction.
8http://cortex.p.gen.nz/research/scrolling/
346

0	  
4	  
8	  
12	  
16	  
20	  
24	  
0	   50	   100	   150	   200	  
Gain	  
Input	  Velocity	  (counts/s)	  
Oﬀ	  1	  
2	  
3	  
4	  
5	  
6	  7	  
8	  
(a) Mac OS X (Generic Device).
0"
4"
8"
12"
16"
20"
24"
0" 50" 100" 150" 200"
Axis%Title%
Input%Velocity%(counts/s)%
7↑"
7↓"
5↑"
5↓"
3↑"
3↓"
1↑"
1↓" (b) Microsoft IntelliPoint: up (solid)
and down (dashed).
0"
4"
8"
12"
16"
20"
24"
0" 50" 100" 150" 200"
Axis%Title%
Input%Velocity%(counts/s)%
Max"
None"
9"
8"
117"
(c) Logitech Control Center.
Figure 3: Gain scale factors across input velocity (counts per second) with Mac OS X, Microsoft IntelliPoint (under Windows
7), and Logitech drivers under Mac OS X. Gain is measured as the level of ampliﬁcation in the system’s base unit (pixels per
count for Mac OS X and Logitech; lines per count for Microsoft IntelliPoint), and is plotted at varying levels of each driver’s
respective UI sliders for acceleration.
0
100
200
300
400
0 1 2 3 4 5
Output Velocity (pixels/s)  
Time (s) 
Oﬀ 
6 
(a) Mac OS X (Generic Device).
0
30
60
90
120
0 1 2 3 4 5
Output Velocity (lines/s)  
Time (s) 
Oﬀ 
2 (b) Microsoft IntelliPoint.
Figure 4: Output velocity response to repeated clutching.
0
200
400
600
800
1000
1200
1400
0 1 2 3 4 5
Output Velocity (pixels/s)  
Time (s) 
50 c/s 
100 c/s 
200 c/s 
400 c/s 
(a) Output velocity over time as a constant input velocity is
maintained.
0
1
2
3
4
5
6
0 50 100 150 200
Gain 
Input Velocity (counts/s)  
Slow 
4 
5 
6 
7 
8 
9 
10 
Fast 
3 
2 
(b) Gain across input velocity at levels of the “speed” slider shown
in Figure 2(c).
Figure 5: Logitech’s Control Center: Attendance to duration and the control of the “speed” slider.
347

0
500
1000
1500
0 2 4 6
Output Velocity (pixels/s)  
Time (s) 
Oﬀ 
3 
6 
Down Up Down 
(a) Mac OS X (Generic Device).
0	  
200	  
400	  
600	  
0	   2	   4	   6	  
Output	  Velocity	  (lines/s)	  
Time	  (s)	  
Oﬀ	  1	  
3	  
Down	   Up	   Down	  
(b) Microsoft IntelliPoint.
Figure 6: Output velocity over time as a constant velocity is maintained but input direction is switched at the dashed lines (2
and 4s). Three curves—two levels of acceleration and one with acceleration disabled—are shown.
Clutching as an Input
Figure 4 shows how Mac OS X and Microsoft IntelliPoint
drivers respond to clutching of the scroll wheel (Logitech’s
response is not shown as it is similar to Mac OS X). The main
ﬁnding here is that IntelliPoint cumulatively adds gain across
successive clutches when acceleration is turned on (similar to
the technique described by Hinckley and Cutrell [17]). Mac
OS X (Figure 4(a)) and Logitech drivers do not vary their
response (the reduced gain for the ﬁrst impulse is due to an
empty smoothing window), however, comments in the Mac
OS X driver source code9 indicate the timeout value for reset-
ting the smoothing window was chosen speciﬁcally to avoid
doing so between clutches.
Duration as an Input
Figure 5(a) shows that Logitech’s driver attends to scroll du-
ration while Mac OS X and Microsoft IntelliPoint do not (not
shown). When stimulated with a constant velocity scroll rate,
Logitech’s output velocity diminishes over approximately
2.5s. This time-based fall-off is particularly marked at high
input velocities, and it is therefore likely designed to en-
hance user performance with Logitech’s free-spinning iner-
tial scroll wheels that readily allow high input speeds.
Other Features
It is interesting and potentially important that the speed and
acceleration parameters in Logitech’s Control Center interact
with one another, and that setting acceleration to ‘None’ does
not disable acceleration: Figure 5(b) shows the gain observed
9IOHIDSystem/IOHIPointing.cpp, lines 555–559
at various settings of the speed slider with the acceleration
slider set to “None”. The noise at low speeds is puzzling,
and the lack of constant gain suggests that Logitech Control
Center should be used with caution in research experiments.
DISCUSSION
We have presented a framework for understanding the fac-
tors inﬂuencing the transformation of human action with
scrolling devices (particularly scroll wheels) into resultant
scrolling output. We have also reverse engineered the
scrolling transfer functions from the drivers of popular man-
ufacturers, with results demonstrating substantial variation in
both the factors attended to and the manner in which they do
so. Key observations include the fact that Microsoft’s Intel-
liPoint drivers apply different levels of gain to each scrolling
directions (presumably to accommodate differences in hu-
man mechanics), that they also apply cumulative gain across
repeated clutching actions, and that Logitech’s drivers on
Mac OS X apply variable gain even when user settings stip-
ulate that acceleration should be turned off.
The framework and ﬁndings have several implications for
research that aims to develop new transfer functions or use
scrolling devices in experimental conditions, and there are
many avenues for further work.
Facilitating Rigour in Scrolling Studies
Scrolling researchers are typically interested in either new
input devices [e.g., 24], transfer functions [e.g., 11, 15], or
new interactive techniques [e.g., 18]. Scrolling devices are
348

also used in experiments where scrolling is not the focus of
an investigation, but as an interaction tool.
In all cases, comparative evaluations are normally conducted
to measure performance over the state of the art, and the
choices made in the implementation and administration of
experimental treatments must be made with the awareness
and knowledge of the underlying transfer functions. As
experimental software typically operates on-top of existing
drivers (rather than replacing them), understanding the inter-
action between the transfer function of the driver and that of
the experimental condition is critical in answering the ques-
tion of whether the treatment is causing any observed dif-
ference, or whether it may be attributed to the interacting
transfer functions.
What should researchers do to maximise rigour and facili-
tate replication? We make three recommendations. First,
a constant level of gain (i.e. scroll acceleration is disabled)
should be used as a baseline in experiments where gain is
not intended to be a factor. Given the complex nature of the
gain functions observed in our results, their variation across
drivers, and their potential volatility across different ver-
sions from the same manufacturer, replicating non-constant
gain settings across experiments may be extremely difﬁcult.
Note that using constant gain also means that there should
be no adaptive translation, such as a transition from line to
page-based scrolling units reported by Gillick et al. [12, 13]
(we are unaware of commercial drivers that do so, how-
ever some Logitech mice have a mechanical switch that the
driver can activate to transition the wheel from detented to
free-spinning when a threshold scroll velocity is exceeded—
altering the possible range and behaviour of a user’s input).
Second, user settings for disabling acceleration should be
treated with suspicion, and researchers should check care-
fully whether acceleration is actually disabled. Ideally, an
inspection similar to that described in this paper should be
conducted, but otherwise, researchers should avoid drivers
that are known to exhibit non-constant velocity scale factors
(e.g., Logitech’s drivers under Mac OS X, as reported here).
Consequently, when gain is disabled, how this was achieved
(user settings, API calls, etc.) should be reported.
The third recommendation is to report details of the transfer
function, described next.
Reporting Scrolling Transfer Functions
In reporting a transfer function, there are two components
that deserve attention: the translation and the gain.
The translation concerns the device and display resolutions,
the level of action required to generate a scroll event on the
device, and the magnitude of those events (in display units).
The device resolution considers the number of events re-
ported per unit of physical action: for example, Logitech’s
MX500 mouse reports 24 events per complete wheel rota-
tion, while Microsoft’s Wheel Mouse Optical reports 18 (i.e.
a complete revolution of the MX500 is equivalent to 1.33
revolutions of the Wheel Mouse Optical). The level of ac-
tion required to generate a scroll event considers the lower-
bounds of physical action generating scroll events: in a scroll
wheel, this would be the minimum wheel rotation and resis-
tance to generate a scroll event, but for trackpad scroll ges-
tures it could concern the minimum velocity of movement,
or the minimum total displacement. Finally, the event mag-
nitude considers the number of pixels, lines, or pages that the
minimum scroll event moves (which may be fractional with
high resolution devices [e.g., 21]).
Where a constant gain is used, the scale factor between the
event magnitudes from the translation component should be
reported. Where non-constant gain is used, the gain func-
tion(s) should be described using formulas, ﬁgures, and/or
tables with the mapping between the output of the translation
component to the ﬁnal scroll behaviour. In both cases, the
mechanics of the device and input/output resolutions should
be reported.
Limitations and Further Work
Most of the gain functions analysed in this paper were re-
verse engineered without source code. It is therefore possible
that our descriptions of the functions are incomplete because
we failed to probe a salient input parameter: for example,
we did not probe for attendance to acceleration or jerk (the
derivative of acceleration). Similarly, we analysed the data
that is sent from the operating system to user applications,
and did not consider possible manipulation of that data by
applications or the frameworks/libraries they are built upon.
These higher-level systems have access to information about
the information space being navigated (for example, the doc-
ument length [11]) that may be used to augment scrolling
behaviour. We have, however, presented a framework for un-
derstanding that such parameters could inﬂuence behaviour,
and a method for inspecting their impact if required.
Our attempt to reverse engineer the behaviour of Microsoft’s
IntelliPoint driver under Mac OS X failed because the driver
prevented us from communicating with the EchoMouse.
There are two hardware solutions to this problem: either
EchoMouse could be engineered to store a pre-programmed
set of signals to be emulated, or it could be designed to sup-
port a second USB input (one for sending signals to Echo-
Mouse, and the other for sending messages to the driver).
None of the devices we tested supplied information about
their physical units or resolution of input. Our analysis there-
fore used “counts” rather than physical units (such as de-
grees). Similarly, to our knowledge, drivers currently do not
consider the display resolution when calculating gain (e.g.,
pixel size, pixel density, and/or scaling factors); but as higher
resolution devices and displays become available, there are
opportunities for investigating how transfer functions can
be better designed to adapt to different input and output
resolutions—for example, the interaction between user per-
formance and input resolution (both device resolution, and
human capabilities), and similarly for the output resolution
(adapting to different display conﬁgurations).
There are also other types of scrolling hardware that have
not been examined here, most notably trackpads and touch
mice (devices that feature a touch-sensitive surface). Some of
these devices feature transfer functions that enable features
such as simulated momentum and friction when scrolling.
349

CONCLUSIONS
Scrolling is an elemental interface control, and system trans-
fer functions are fundamental in determining their behaviour.
Yet despite their importance, scrolling transfer functions
have received little research attention. This paper examined
how scrolling transfer functions work and the input param-
eters they attend to. We described a method to reverse en-
gineer the state of the art in scrolling transfer functions, and
we used the method to expose how systems vary with the
input parameters they attend to and in their processing of
these parameters. As well as providing a ﬁrmer foundation
for research into improving scrolling transfer functions, the
paper’s ﬁndings also suggest that when evaluating scrolling
techniques, researchers should be cautious about potential
interactions between the system transfer function and experi-
mental treatment. The method proposed allows system trans-
fer functions to be precisely recorded, aiding experimental
replication. In further work, we will examine gesture-based
transfer functions on touchscreens and trackpads, and com-
pare user performance with different functions.
ACKNOWLEDGEMENTS
This work was supported by a Royal Society of New Zealand
Marsden Grant 10-UOC-020.
REFERENCES
1. Arthur, K. W., Matic, N., and Ausbeck, P. Evaluating
touch gestures for scrolling on notebook computers. In
Proc. CHI EA ’08, ACM (New York, NY , USA, 2008),
2943–2948.
2. Bates, B. M., Dezmelyk, R., Ingman, R., Lieb, R., Mc-
Gowan, S., Ray, K., Schumacher, S., Sherman, N. C.,
Stern, D., van Flander, M., and Zimmerman, R. HID
usage tables, Version 1.12. USB Implementer’s Forum
(2004).
3. Bergman, M., Peuranch, T., Schmidt, T., McGowan, S.,
Crowe, J., Dezmelyk, R., Zimmerman, R., van Flan-
dern, M., Nathan, B., Davis, M., and Rayhawk, J. De-
vice class deﬁnition for human interface devices (HID),
Version 1.11. USB Implementer’s Forum (June 2001).
4. Buxton, W. Lexical and pragmatic considerations of
input structures. SIGGRAPH Computer Graphics 17, 1
(January 1983), 31–37.
5. Buxton, W. Touch, gesture, and marking. In Human-
Computer Interaction: Toward the Year 2000, R. M.
Baecker, J. Grudin, W. Buxton, and S. Greenberg, Eds.
Morgan Kaufmann Publishers, San Francisco, 1995,
ch. 7, 469–482.
6. Card, S. K., Mackinlay, J. D., and Robertson, G. G. The
design space of input devices. In Proc. CHI ’90, ACM
(New York, NY , USA, 1990), 117–124.
7. Card, S. K., Mackinlay, J. D., and Robertson, G. G. A
morphological analysis of the design space of input
devices. ACM Transactions on Information Systems 9,
2 (Apr. 1991), 99–122.
8. Casiez, G., and Roussel, N. No more bricolage! Meth-
ods and tools to characterize, replicate and compare
pointing transfer functions. In Proc. UIST ’11, ACM
(New York, NY , USA, 2011), 603–614.
9. Chipman, L. E., Bederson, B. B., and Golbeck, J. A.
Slidebar: analysis of a linear input device. Behaviour &
Information Technology 23, 1 (2004), 1–9.
10. Cockburn, A., and Gutwin, C. A predictive model of
human performance with scrolling and hierarchial lists.
Human-Computer Interaction 24, 3 (2009), 273–314.
11. Cockburn, A., Quinn, P., Gutwin, C., and Fitchett, S.
Improving scrolling devices with document length de-
pendent gain. In Proc. CHI ’12, ACM (New York, NY ,
USA, 2012), 267–276.
12. Gillick, W. G., and Lam, C. C., U.S. Patent No.
5530455. U.S. Patent and Trademark Ofﬁce (Wash-
ington, DC, 1996).
13. Gillick, W. G., and Rosenberg, R. A., U.S. Patent No.
5446481. U.S. Patent and Trademark Ofﬁce (Washing-
ton, DC, August 1995).
14. Gutwin, C., and Cockburn, A. Improving list revisita-
tion with listmaps. In Proc. A VI ’06, ACM Press (New
York, NY , USA, 2006), 396–403.
15. Hinckley, K., Cutrell, E., Bathiche, S., and Muss, T.
Quantitative analysis of scrolling techniques. In Proc.
CHI ’02, ACM (New York, NY , USA, 2002), 65–72.
16. Hinckley, K., and Sinclair, M. Touch-sensing input
devices. In Proc. CHI ’99, ACM (New York, NY , USA,
1999), 223–230.
17. Hinckley, K. P., and Cutrell, E. B., U.S. Patent No.
7173637. U.S. Patent and Trademark Ofﬁce (Washing-
ton, DC, 2007).
18. Kobayashi, M., and Igarashi, T. MoreWheel: Multi-
mode scroll-wheeling depending on the cursor location.
In UIST 2006 Adjunct Proceedings: Demonstrations
(2006), 57–58.
19. Lipscomb, J. S., and Pique, M. E. Analog input device
physical characteristics. SIGCHI Bulletin 25, 3 (July
1993), 40–45.
20. Mackinlay, J., Card, S. K., and Robertson, G. G. A
semantic analysis of the design space of input devices.
Human-Computer Interaction 5, 2–3 (1990), 145–190.
21. Microsoft Corporation. Enhanced wheel support in
windows. Tech. rep., 2010.
22. Montalcini, A. L., U.S. Patent No. 7661072. U.S.
Patent and Trademark Ofﬁce (Washington, DC, 2010).
23. Wherry, E. Scroll ring performance evaluation. In CHI
EA ’03, ACM (New York, NY , USA, 2003), 758–759.
24. Zhai, S., Smith, B. A., and Selker, T. Improving brows-
ing performance: A study of four input devices for
scrolling and pointing tasks. In Proc. INTERACT ’97,
Chapman & Hall, Ltd. (London, UK, 1997), 286–293.
350