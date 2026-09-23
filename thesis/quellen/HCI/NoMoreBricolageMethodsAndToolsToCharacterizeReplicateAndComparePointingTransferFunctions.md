# NoMoreBricolageMethodsAndToolsToCharacterizeReplicateAndComparePointingTransferFunctions

Quelle: C:\Users\Felix\Desktop\Master\Thesis\Quellen\HCI\NoMoreBricolageMethodsAndToolsToCharacterizeReplicateAndComparePointingTransferFunctions.pdf

---
No more Bricolage! Methods and Tools to Characterize,
Replicate and Compare Pointing Transfer Functions
Géry Casiez 1,2,3 and Nicolas Roussel 2
1LIFL, 2INRIA Lille & 3University of Lille
Villeneuve d’Ascq, France
gery.casiez@liﬂ.fr, nicolas.roussel@inria.fr
ABSTRACT
Transfer functions are the only pointing facilitation technique
actually used in modern graphical interfaces involving the in-
direct control of an on-screen cursor. But despite their gen-
eral use, very little is known about them. We present Echo-
Mouse, a device we created to characterize the transfer func-
tions of any system, and libpointing, a toolkit that we devel-
oped to replicate and compare the ones used by Windows,
OS X and Xorg. We describe these functions and report on
an experiment that compared the default one of the three sys-
tems. Our results show that these default functions improve
performance up to 24% compared to a unitless constant CD
gain. We also found signiﬁcant differences between them,
with the one from OS X improving performance for small
target widths but reducing its performance up to 9% for larger
ones compared to Windows and Xorg. These results notably
suggest replacing the constant CD gain function commonly
used by HCI researchers by the default function of the con-
sidered systems.
ACM Classiﬁcation: H.5.2 [Information interfaces and
presentation]: User interfaces - Graphical user interfaces.
General terms: Documentation, Experimentation, Human
Factors, Measurement, Performance, Standardization
Keywords: Pointing, control-display gain functions,
CD gain, pointer acceleration, transfer functions, toolkit
INTRODUCTION
Indirect control of an on-screen cursor with a separate device
has been the prevalent way of pointing in graphical inter-
faces for many years. The mouse is undoubtedly the most
popular pointing device in this context. As explained by
Moggridge [20], it was not chosen simply because Engelbart
invented it, but because it turned out to be the device that
performed best for pointing and clicking on a display, out-
performing everything else that was tried in early tests with
users. More than forty years later, the mouse still provides
a good match between human performance and the demands
Permission to make digital or hard copies of all or part of this work for
personal or classroom use is granted without fee provided that copies are
not made or distributed for proﬁt or commercial advantage and that copies
bear this notice and the full citation on the ﬁrst page. To copy otherwise, to
republish, to post on servers or to redistribute to lists, requires prior speciﬁc
permission and/or a fee.
UIST’11,October 16–19, 2011, Santa Barbara, CA, USA.
Copyright 2011 ACM 978-1-4503-0716-1/11/10...$10.00.
of desktop graphical interfaces [13], the touchpad offering a
similar match on laptop conﬁgurations. Despite the current
trend for tactile screens, indirect pointing will thus probably
remain the prevalent paradigm for some time.
In indirect pointing conﬁgurations, movements in the control
space can be mapped to different ones in the display space.
We use the term transfer function to refer to the relationship
between movements in the two spaces. It is very important
to note that in order for this relationship to be meaningful, it
has to be hardware-independent. All movements must thus
be described using standard length and time units (e.g. me-
ters) and not device-speciﬁc ones (e.g. mickeys and pixels).
In the case of simple linear relations, the term CD gain1 is
commonly used to refer to the scale factor between the two
spaces, e.g. CDgain = Vdisplay/Vcontrol [8]. To be mean-
ingful, this coefﬁcient must be unitless, which will only be
the case if the two factors involved in its computation are ex-
pressed using the same length and time units. The CD gain
can be constant or dynamically adjusted over time based on
control space kinetics or extrinsic information, for example.
Whether static or dynamic, CD gain settings involve a trade-
off between gross and ﬁne positioning [16]. High gains re-
duce the time it takes to approach a distant target but make
it hard to precisely position the cursor on it. Conversely,
low gains support precise positioning but increase the time
to cover large distances.
It is generally assumed that in accordance with Meyer et al.’s
optimized initial impulse model [19], the so-called “pointer
acceleration” mechanisms implemented in modern desktops
increase the CD gain as the user’s hand or ﬁnger velocity in-
creases. The transfer functions of Microsoft Windows, Ap-
ple OS X and Xorg (the X.Org Foundation server) are ac-
tually the only pointing facilitation mechanisms available to
all users of these systems. But despite their general use, very
little is known about them. Current knowledge on velocity-
based transfer functions relies on evaluations of basic ones
adapting the CD gain in discrete or continuous ways using
low-order polynomials, e.g. [11, 14, 21]. The internal de-
tails and design rationales of the functions that we all use are
mostly unknown. And with the notable exception of Casiez
et al.’s work on Windows XP and Vista functions [8], their
impact has never been studied.
This paper reports on efforts we made with the long-term
goals of advancing this state of knowledge and bringing it
1The term CD ratio is also used and corresponds to the inverse of the gain.
Paper Session: Pointing
UIST’11, October 16–19, 2011, Santa Barbara, CA, USA
603

in line with current practices. The paper is organized as fol-
lows. We ﬁrst brieﬂy review the related work, explaining
how pointing facilitation research deals with transfer func-
tions and what is known about them. We then explain what
is actually involved from a system perspective when point-
ing on a desktop. We present EchoMouse, an HID device we
created to characterize the transfer functions of any system,
and libpointing, a toolkit that we developed to replicate
and compare the ones used by Windows, OS X and Xorg 2.
We describe these functions and report on an experiment that
compared the default one of the three systems. We conclude
with a discussion and implications for future work.
RELATED WORK
Pointing transfer functions can be considered as low-level
and general-purpose mechanisms for pointing facilitation.
Before explaining what is known about them, it is interesting
to look at how research on other pointing facilitation tech-
niques takes them into consideration.
Transfer functions in other pointing facilitation research
As we explained, it is usually assumed that desktop systems
dynamically adjust the CD gain based on movement speed.
This behavior might well interfere with other pointing facil-
itation mechanisms, especially those that manipulate the CD
gain, e.g. [23, 10, 5, 22]. As a consequence, one would ex-
pect researchers working on pointing facilitation to try to dis-
able the system’s transfer function, to precisely characterize
it, or to systematically investigate its effect.
Transfer functions are usually treated as control variables,
meaning they might inﬂuence a dependent variable but are
not under investigation and are thus held constant from one
test condition to another. One would expect a clear descrip-
tion of these control variables to ease the replication of a
technique or experiment with different hardware conﬁgura-
tions or operating systems, in case the control variable would
in fact be a confounding one. However a review of the recent
literature on pointing facilitation shows that the level of de-
tails provided is often incomplete or unclear.
Numerous authors report using a constant CD gain or ratio as
a baseline condition or as a basis for their technique but fail to
describe it with sufﬁcient details. In [10], for example, Cock-
burn & Firth explain that the CD gain “was set to a constant
ratio of approximately 1:1.6” in experiments running on a
Linux system, but do not explain why they chose this partic-
ular value nor how they enforced it. The predictive pointing
technique of the Delphian Desktop was evaluated by Asano
et al. on Windows XP with a CD ratio “set to a constant
value of 0.5” [2]. Again, the paper does not explain how this
ratio was enforced. For the Bubble Cursor on the same sys-
tem, Grossman & Balakrishnan say that “mouse acceleration
was set to 0, with a control-display ratio of 1/2” [12]. The ex-
act meaning of “set to 0” is unclear considering the Windows
XP conﬁguration interface (Figure 4), and we will see that a
unitless constant ratio of 0.5 is not achievable through it (Fig-
ure 6). In their study of sticky targets, Mandryk & Gutwin
said “Windows pointer acceleration was turned off, and the
2The source code for EchoMouse and libpointing is available
from http://libpointing.org/.
baseline mouse gain was set to the midpoint” [18]. The exact
deﬁnition of this baseline is unknown which is unfortunate
since the authors scaled it by 11 values between 0.05 and
1.0, CD gain being one of the experiment factors. In their
own study of sticky icons, Worden et al. say that “normal
mouse gain was set at a constant 1 mickey to 3 pixels ra-
tio for all conditions” [23]. But as the mouse and display
resolutions are not speciﬁed, this gain can not be expressed
in a unitless hardware-independent way, which makes their
results difﬁcult to compare with those from other studies.
Enforcing a hardware-independent transfer function, even a
constant gain, is actually quite difﬁcult with current sys-
tems. Wobbrock et al. had to go to great lengths to dis-
able Windows Vista’s pointer acceleration and dynamically
control the CD gain for their Angle Mouse study, for exam-
ple. They acknowledge that “although some on-line docu-
mentation discusses pointer ballistics in Windows, it does not
contain sufﬁcient information to establish the slider-to-gain
mapping.” [22]. A good way of enforcing a transfer function
is to use a device not attached to the system cursor and an API
that provides access to its raw data. As an example, Blanch
et al. used the absolute coordinates of a puck on a Wacom
tablet as input for their Semantic Pointing technique [5].
An alternative to enforcing a particular baseline is to use the
default transfer function of the system. For the Ninja Cur-
sors, Kobayashi & Igarashi say “the mouse speed and accel-
eration rate were set to the Windows XP default values (mid-
dle speed, no acceleration)” [15]. For DynaSpot, Chapuis
et al. used “the default X Window acceleration function” [9].
As it is unclear whether these functions take into account spe-
ciﬁc characteristics of the devices, extensive details should
be provided about them including their resolution (per length
unit) and frequency. A problem with this approach is that it
will be possible to replicate or reproduce the experiment only
as long as the original system can be used.
In some cases, there is simply no way of knowing which
transfer function was used. In [17], for example, MacKen-
zie & Isokoski only report using “an optical USB Microsoft
IntelliMouse with four buttons and a scroll wheel” and an
“experimental software written in Java”. Mouse data was
presumably provided to the Java application by the underly-
ing operating system through its operative transfer function,
but none of them is explicitly mentioned in the paper.
What is known about pointing transfer functions
An extensive review of the literature on transfer functions has
been recently conducted by Casiez et al. [8]. Prior to their
work, research on the effects of these functions on pointing
performance had been largely inconclusive. In all constant
CD gain studies, the range of gain evaluated was either small
or had quantization problems. And the few dynamic transfer
functions evaluated poorly resembled the ones used in mod-
ern systems, most of them involving a few discrete steps or
simplistic low-level polynomials, e.g. [11, 14, 21].
Casiez et al. [8] showed there exists a wide range of constant
CD gains for which performance is constant and provided a
way to compute that range knowing the hardware and tar-
get widths and distances used in a particular context. They
Paper Session: Pointing
UIST’11, October 16–19, 2011, Santa Barbara, CA, USA
604

also showed that the acceleration mechanisms of Windows
XP resulted in faster pointing than constant gain functions:
they found an average 3.3% improvement and up to 5.6% for
small targets or long distances. In a different study, Casiez
and V ogel showed that the impact of transfer functions on
performance can be severe in the case of force input [7].
Windows XP mechanisms were re-implemented for the study
described in [8] based on information extracted from the
Windows registry and documentation publicly available from
Microsoft [1]. However, the cursor controlled by this imple-
mentation was not in perfect sync with the system one due to
missing details in the documentation. Figure 3 of Casiez et
al.’s paper shows a plot of four Windows XP functions based
on their custom implementation. It also shows a plot of six
OS X functions that were estimated from the analysis of pub-
licly available Apple source code, but not re-implemented.
POINTING: A SYSTEM PERSPECTIVE
Most if not all modern pointing devices conform to the Hu-
man Interface Devices(HID) class of the USB standard. This
class covers a variety of equipments including keyboards,
mice, touchpads and joysticks but also telephones, remote
controls, barcode readers and voltmeters. HID devices are
thus required to provide extensive descriptions of their char-
acteristics to be properly recognized and used. Among other
things, a pointing device description speciﬁes for each axis
whether transmitted values (called counts) are absolute or
relative, linear or nonlinear, their byte size, their logical
range, the corresponding physical range and the unit system
and exponent used. The description also speciﬁes the time
interval that should be used when polling for data transfers.
The HID speciﬁcation deﬁnes a simple boot report format
for mice that allows to use them before the operating sys-
tem is loaded, for low-level system conﬁguration [3, p. 61].
This format describes movements along two axis with rela-
tive, linear, unitless counts encoded with one byte per axis,
between -127 and +127. Most mice support this format and
for many, it is also the one they use to report to the system
once it is loaded. This format is also supported by touchpads,
although they could provide an absolute location, so they can
be used in place of a mouse even at boot time.
The polling interval is typically set to 8 ms for mice, leading
to an update frequency of 125 Hz. For devices that spec-
ify their logical and physical range and their unit system and
exponent, the resolution can be computed in counts per unit
with: Res = LogRange/(P hysRange∗ 10Exp). Unfor-
tunately, many report formats including the boot one spec-
ify unitless values with no physical range, which makes this
formula inapplicable. For these devices, systems usually as-
sume a resolution of 400 CPI3.
The fact that systems have no reliable way of know-
ing a pointing device’s resolution is becoming more and
more problematic as manufacturers not only propose high-
resolution ones but also some where it is adjustable 4. A
3We will use CPI (counts per inch) and PPI (pixels per inch) instead of DPI
to make a clear distinction between input and output resolutions.
4The resolution of the Logitech Gaming Mouse G500 can be adjusted be-
tween 200 and 5700 CPI, for example.
higher resolution results in more counts reported for the same
distance traveled by the device, by sending bigger values at
the same rate or by reporting more often. High-resolution
mice indeed use two-bytes values for each axis and can set
a polling interval as low as 1 ms. A transfer function not
aware of the resolution change or not taking time properly
into account will inevitably misinterpret the reported counts
and produce undesirable effects, the most common one being
considerably ampliﬁed movements. This problem is so fre-
quent that a lot of people equate the resolution of the device
with the cursor speed, as illustrated by this text displayed in
the mouse section of a consumer electronics retailer:
“Speciﬁed in DPI, the resolution corresponds to the
speed of the mouse cursor on your screen. The higher it
is, the less you will have to move the mouse for the same
on-screen distance, though you will be less accurate.”
Changing the resolution of a pointing device or switching
to one with a different resolution should not alter the map-
ping between movements in the control and display spaces.
Changing or reconﬁguring the transfer function should be the
only way of doing that.
ECHOMOUSE
EchoMouse is an electronic device that we designed to
measure a system’s response to pointing movements re-
ceived from an HID equipment. Based on a Microchip PIC
(18LF14K50) programmed in C using the PICkit 2 develop-
ment environment, it includes a switch and two LEDs for
debugging purposes (Figure 1). Its program uses a mouse
ﬁrmware provided by Microchip, so it appears as an ordinary
HID mouse to the system. It has no motion sensor, though.
We instead added a USB endpoint to the ﬁrmware to which
a program can send an HID report to be echoed by the de-
vice on its mouse endpoint. Reports are expected and echoed
in HID boot format. They are thus indistinguishable from
genuine mouse reports and handled as such by the system.
We have used our EchoMouse to look into the transfer func-
tions of Windows, OS X and Xorg with a speciﬁc program
implementing the following procedure. After placing the






 ͘
͘

HWŝĐ<ŝƚϮƉŝŶϭ





͘
Figure 1: Electronic diagram of EchoMouse. The 3.3V
can be easily generated from the 5V of the USB port using
a voltage divider or a Zener diode.
Paper Session: Pointing
UIST’11, October 16–19, 2011, Santa Barbara, CA, USA
605

  1
  4
0.0 0.2 0.4 0.6 0.8 1.0 1.2
motor speed (m/s)
0
5
10
15
20
25
30
35
40
45visual speed (m/s)
  7
echomouse:osx
  5
  6
  8
  9
  3
  10
  2
Figure 2: Speed plot for OS X 10.5.6 transfer functions
(n = 10). Count and pixel values were converted to speed
values considering the actual resolution of the monitor used
and assuming a 400 CPI resolution for EchoMouse.
system cursor on the left edge of the screen, the program pre-
pares an HID report describing a (dx, 0) translation. It sends
it n times to EchoMouse at 125 Hz, waits for a few millisec-
onds and polls the system for the new cursor position. It then
divides the horizontal pixel distance traveled by the cursor
by n and stores this number along with dx in a table. This
procedure accounts for potential subpixel precision. When
repeated for all dx between 1 and 127, it provides an exten-
sional description of the transfer function used by the system.
Repeating this for every pointer acceleration setting provides
the descriptions of all the functions supported by the system.
Figures 2 and 3 illustrate the 10 transfer functions available
in OS X 10.5.6 through theTrackingslider of the mouse pref-
erence pane shown on Figure 5. Figure 2 shows the speed in
display space as a function of speed in control space. One
can easily see with this plot that the functions used by OS
X are not linear, can not be approximated by a single low-
order polynomial and are likely deﬁned in a piecewise fash-
ion. The singularity observed in function 7 is inexplicable,
however. And the differences between functions are not easy
to perceive, especially at low speeds.
Figure 3 shows the CD gain as a function of speed in con-
trol space. This plot makes it easier to compare the functions
at low speeds and to relate them to the movements in motor
space, a CD gain of 1 corresponding to a horizontal line. The
fact that some of the functions strongly decrease after a cer-
tain speed is hard to explain. We hypothesize that the func-
tions were designed in a spatial space like the one of Figure2
and that the designers were actually not aware of this slope
change. The singularity observed in function 7 remains in-
explicable. At this point, one can only hypothesize that the
designers of the functions never tried to plot them.
EchoMouse allowed us to investigate the transfer functions
used by three systems without spending too much time on
their internals. Replicating the device is relatively easy. A
similar but pure software approach is also probably achiev-
  1
  4
0.0 0.2 0.4 0.6 0.8 1.0 1.2
motor speed (m/s)
0
10
20
30
40
50
60
70gain
  7
echomouse:osx
  5
  6
  8
  9
  3
  10
  2
Figure 3: Gain plot of the data shown in Figure 2.
able by developing fake mouse drivers, e.g. using uinput
on Linux, or synthesizing low-level mouse motions, e.g. us-
ing the SendInput function on Windows. The EchoMouse
approach is however restricted to observation, it can not alter
the system functions. One can never be sure that the pseudo
motions injected in the system have actually been processed
when reading the cursor location. And one can hardly know
if and which hardware or movement characteristics are taken
into account by the system when applying the functions.
Although valuable for preliminary studies, an outside obser-
vation point is not enough to fully understand and compare
the transfer functions used by modern desktop interfaces. In
addition to EchoMouse, we thus developed libpointing,
a toolkit that allows to replicate and compare them.
LIBPOINTING
The libpointing toolkit was designed with several goals
in mind. First, we wanted a way of directly accessing HID
pointing devices to bypass the system’s transfer functions.
Second, we wanted to replicate as faithfully as possible the
transfer functions of Windows, OS X and Xorg. Third, we
wanted the toolkit to run on these platforms to be able to
compare our implementations to the genuine ones. And
fourth, we wanted to support comparisons between the repli-
cated functions and other ones.
The toolkit consists of about 10,000 lines of C++ developed
on OS X 10.6, Ubuntu 10.10 and Windows XP, Vista and 7.
Although parts of it use the Qt framework, care has been
taken so that its essential components can be used with other
GUI frameworks. A key aspect of libpointing is that it
supports the use of URIs [4] to specify input and display de-
vices as well as transfer functions. Combined with object
factories, this makes it possible to (re)deﬁne at runtime the
instances used by a program and contributes remarkably to
the ﬂexibility of the whole. The following summarizes the
main other features of the toolkit.
Pointing devices
PointingDevice instances are created from URIs using the
static create method of that class. Other methods allow to
Paper Session: Pointing
UIST’11, October 16–19, 2011, Santa Barbara, CA, USA
606

check whether a device is active, to obtain its resolution (in
counts per inch), update frequency and URI, and to associate
a callback to it. The callback will be executed every time
the device has a motion or button event to report, passing
it a timestamp, dx and dy values (in counts) and an integer
coding the buttons states.
The toolkit provides direct access to any connected HID
pointing device through platform-speciﬁc subclasses and
URIs such as osxhid:/USB/4600000/AppleUSBTCButtons.
The special URI any: matches any supported device and
will list the available ones in the console if a debug option
is passed on the query string. All HID PointingDevice
objects support hot (re)plugging of the corresponding de-
vice. The toolkit also includes two pseudo-device sub-
classes for debugging and testing that can be instanti-
ated with URIs such as noisy:?cpi=400&hz=125 and
dummy:?cpi=800&hz=125. The ﬁrst one will execute the
callback at the speciﬁed frequency to report movements syn-
thesized by a 2D Perlin noise generator. The second one will
never execute the callback but will return the speciﬁed values
when queried for its resolution and update frequency.
Display devices
DisplayDevice instances are also created from URIs using
a static create method. Other methods allow to obtain the
horizontal and vertical bounds (in pixels), sizes (in inches or
millimeters) and resolutions (in pixels per inch) as well as
the refresh rate and the URI of a particular display.
URIs such as osxdisplay:/69676098 and platform-
speciﬁc subclasses provide access to the displays connected
to the computer. A pseudo-device subclass is also available
that will simply store the conﬁguration values passed on the
query string, e.g. dummy:?ppi=96&hz=60, and return them
as expected when requested by the above methods.
Transfer functions
TransferFunction instances are created using a static
create method from a URI, a PointingDevice and a
DisplayDevice. Other methods allow to obtain the URI
of a function, to clear its internal state and to apply it to
dxin and dyin values (in counts) with a timestamp to pro-
duce dxout and dyout values (in pixels). The toolkit pro-
vides subclasses that correspond to different transfer func-
tions. Care has been taken so that all implementations are
platform-independent, i.e. all the transfer functions proposed
by libpointing can be used on all the supported platforms.
Although it imposes some constraints, we believe that having
cross-platform implementations is important: a long-term
goal for libpointing could be to serve as a living archive
of the functions tried and used in research and commercial
systems.
Three subclasses replicate the functions used by Windows
(windows:), OS X (osx:) and Xorg (xorg:). The next
section of the paper will describe these functions with exten-
sive details. The special URI system: can be used to create
the single appropriate instance of these subclasses that cor-
responds to the function used by the system. Conﬁguration
settings passed on the optional query string are applied to
both the created instance and the system function.
Two other subclasses implement constant CD gain in both
the naive and the right way. The ﬁrst one simply multi-
plies the dxin and dyin values by a speciﬁed factor, e.g.
naive:?gain=2, and returns the nearest integers as dxout
and dyout. As this ignores the resolution of the input and out-
put devices and multiplies counts to produce pixels, the effec-
tive unitless gain will most probably not be the one requested
(it is usually higher, input devices having higher resolutions
than displays). The second implementation (constant:)
takes the resolutions into account to effectively produce a
hardware-independent constant gain. It converts counts into
distances, multiplies these distances by the speciﬁed factor
and returns their pixel equivalent.
The toolkit provides various other subclasses, including a
sigmoid: function and a composition: one, the latter al-
lowing to compose an arbitrary number of functions. Adding
a new function is simply a matter of creating a new subclass,
implementing its getURI, clearState and apply methods
and modifying the TransferFunction::create method.
Utilities
libpointing includes some test and debugging programs
that allow to list the available devices and their charac-
teristics, for example. The toolkit also includes a trans-
fer function plotting tool written in Python using mat-
plotlib. This tool proved quite useful as it provided some vi-
sual conﬁrmation that our implementations of the Windows,
OS X, and Xorg functions matched the data collected using
EchoMouse. It was also used to plot all the curves shown in
this paper.
The toolkit also includes an application that allows to test
an arbitrary number of transfer functions at the same time
speciﬁed by their URI as command-line arguments. The pro-
gram creates an on-screen cursor (a small square) for each
function, a single pointing device being used to control all of
them. In addition to supporting informal comparisons be-
tween functions or between different settings of the same
functions, this application proved again quite useful to com-
pare our implementation of the Windows, OS X and Xorg
functions with the system ones.
WINDOWS:, OSX: AND XORG: TRANSFER FUNCTIONS
As explained, one of our goals with libpointing was to
replicate as faithfully as possible the transfer functions of
Windows, OS X and Xorg. We not only wanted cursors con-
trolled by our implementations to follow the system ones as
closely as possible, but we also wanted to replicate the con-
trols on the functions available to users from the relevant con-
ﬁguration interfaces. Our work was based on the documenta-
tion and source code publicly available from Microsoft, Ap-
ple and the Freedesktop community. This section presents
the key ﬁndings that emerged from it.
The curves shown in the ﬁgures below have been plot-
ted assuming the following pointing and display devices:
dummy:?cpi=400&hz=125, dummy:?ppi=96&hz=60.
windows:
The transfer functions used in Microsoft Windows were re-
designed for Windows XP, released in 2001. The rationales
Paper Session: Pointing
UIST’11, October 16–19, 2011, Santa Barbara, CA, USA
607

for this redesign and its general principles are described in a
public document. Together with the conﬁguration interface
found in the “Pointer Options” tab of the “Mouse Properties”
dialog (Figure 4), this document served as a starting point for
our work. Note however that our experience was similar to
that of Wobbrock et al. [22]: the information available was
not sufﬁcient to replicate the functions.
Figure 4: Windows 7 conﬁguration interface with default
settings. The same are used by Windows XP and Vista. No
tooltip or help text is associated to these controls.
The transfer function code runs in an execution space where
ﬂoating-point arithmetic is not available. The following
equations illustrate how a (dx, dy) displacement in counts
is transformed into pixel values when “Enhance pointer pre-
cision” is checked (Figure 4). Two important scale factors
are used to convert count values to input speeds (inConv )
and output speeds to pixel values (outConv). Computations
for the y direction are omitted for brevity:
mag = max(|dx|,|dy|) + min(|dx|,|dy|)/2 (1)
vin = mag× inConv (2)
gain = lookup(vin)× pSpeed/10 (3)
vxin = dxin× inConv (4)
vxout = vxin× gain (5)
px = vxout × outConv (6)
dxout = ⌊px + rx⌋ (7)
The system computes a ﬁxed-point approximation of the dis-
placement vector magnitude (1). The magnitude is converted
into an input velocity (2). A lookup table provides a base
CD gain value for that velocity that is scaled by a factor
(pSpeed) related to the “pointer speed” slider (Figure 4) to
obtain the actual gain to apply (3). Each direction is then
treated separately the following way. The directional input
speed is computed (4) and multiplied by the gain to produce
the output speed (5), which is then converted to a pixel dis-
placement (6). The function returns the integral part (ﬂoor)
of the sum of this displacement and the remainder of previ-
ous computations (7).
Although inConv should be the quotient of the pointing de-
vice update frequency by its CPI resolution, empirical tests
showed that it is always 1/3.5. This constant value might be
an approximation of 125/400, these numbers being common
for mice. Empirical tests also showed that althoughoutConv
should be the quotient of the display resolution by the point-
ing device update frequency, it is not the case either. Its ac-
tual value depends on the display resolution and frequency
but also involves hardwired constants (96 PPI, 60 Hz, 150)
and varies between system versions, XP and Vista differing
from 7. Each of these three versions also uses a different al-
gorithm to handle the x and y remainders: XP clears them
when the pointer stops or changes direction, Vista clears
them only when the pointer changes direction and 7 never
clears them.
The lookup table that returns a base CD gain for a given de-
vice speed is stored in the Windows registry, so it should be
possible to modify it. The position of the “pointer speed”
slider (Figure 4) determines the value of the scale factor
(pSpeed) applied on this base gain. Available values are:
(slow) 1, 2, 4, 6, 8, 10 (default), 12, 14, 16, 18 and 20 (fast).
When “Enhance pointer precision” is unchecked, a naive
constant CD gain is used. Based on the slider position, the
available values for this gain are: (slow) 0.03125, 0.0625,
0.25, 0.5, 0.75, 1.0 (default, one pixel for one count), 1.5,
2.0, 2.5, 3.0 and 3.5 (fast). In this mode, no matter the sys-
tem version, the remainders are never cleared.
The Windows transfer functions are available in
libpointing through URIs such as windows:<version>
?slider=0&epp=true where <version> can be one of
xp, vista or 7. The slider parameter encodes the slider
position between -5 and +5 where 0 corresponds to the de-
fault position. The epp parameter indicates whether “En-
hance pointer precision” is checked or not. Figure 6 shows
the curves associated to each slider position, with and with-
out enhanced pointer precision. Our implementation of these
functions consists of about 200 lines of code. On XP, Vista
and 7, a cursor controlled by it remains superimposed with
the genuine one whatever movements are made. Our cursor
can even respond to pointing device movement before the
system cursor when the vertical synchronization of the dis-
play is disabled.
osx:
The source code for the internal parts of OS X that deal
with pointing transfer functions is publicly available as
part of the IOHIDFamily 5 project, the main concerned
ﬁles being IOHIDSystem/IOHIPointing.cpp and IOHIDSys-
tem/IOHIDSystem.cpp. From the archived versions of this
project, it seems that the current pointer acceleration mech-
anisms ﬁrst appeared in OS X 10.2, released in 2002. How-
ever, although the source code is available, the design ratio-
nales and principles of operation of these mechanisms are
unknown. Figure 5 shows the related conﬁguration inter-
face, located in the “Mouse” pane of the system preferences.
Note that from a user-perspective, the acceleration mecha-
nisms are also badly documented, the tooltip associated to
the slider being potentially misleading.
Figure 5: OS X 10.6.7 conﬁguration interface for the
mouse. A tooltip associated to the slider says “Drag to ad-
just how fast you want the pointer to follow the movement
of your mouse”.
5http://opensource.apple.com/source/IOHIDFamily/
Paper Session: Pointing
UIST’11, October 16–19, 2011, Santa Barbara, CA, USA
608

  -5
  3
0.0 0.2 0.4 0.6 0.8 1.0 1.2
motor speed (m/s)
0
5
10
15
20
25gain
  4
windows:7
  0
  -3
  -2
  -1
  2
  1
  -4
  5
  -1
  3
0.0 0.2 0.4 0.6 0.8 1.0 1.2
motor speed (m/s)
0
2
4
6
8
10
12
14
16gain
  4
windows:7?epp=false
  1
  -3
  2
  -5
  0
  -4
  5
  -2
Figure 6: Windows 7 functions available through the inter-
face shown in Figure 4 with and without enhanced pointer
precision.
0.0 0.2 0.4 0.6 0.8 1.0 1.2
motor speed (m/s)
0
5
10
15
20
25gain
xorg:
  2/1-*
  3/1-*
  5/2-*
  6/1-*
  5/1-*
  4/1-*
  7/2-*
  3/2-*
  */10-*
  11/2-*
  9/2-*
Figure 7: Xorg functions available in Ubuntu 10.10
through the interface shown in Figure 10.
  2.0
  0.5
0.0 0.2 0.4 0.6 0.8 1.0 1.2
motor speed (m/s)
0
10
20
30
40
50
60
70gain
  1.5
osx:mouse
  0.6875
  0.3125  0.125
  3.0
  1.0
  0.875
  0.0
  0.3125
  1.0
0.0 0.2 0.4 0.6 0.8 1.0 1.2
motor speed (m/s)
0
5
10
15
20
25
30gain
  0.875
osx:touchpad
  1.5
  3.0
  0.125
  0.0
  2.0
  0.5
  0.6875
Figure 8: OS X 10.6.7 functions for mice (available
through the interface shown in Figure 5) and touchpads.
  OS X mouse  Windows 7
0.0 0.2 0.4 0.6 0.8 1.0 1.2
motor speed (m/s)
0
2
4
6
8
10
12gain   OS X touchpad
Default functions
  Xorg
Figure 9: Default functions used by Windows 7, OS X
10.6.7 (mouse and touchpad) and Xorg.
Paper Session: Pointing
UIST’11, October 16–19, 2011, Santa Barbara, CA, USA
609

It was relatively easy for us to isolate the portions of
code from IOHIDFamily responsible for pointer acceleration
(about 500 lines of code, mainly in IOHIPointing.cpp) and
to add the necessary wrappers and deﬁnitions to make them
compile on Windows and Linux. The basic operating prin-
ciples followed by this code are also relatively simple and
somewhat similar to those of Windows.
Each pointing device has an associated acceleration table
provided by its driver (some also deﬁne a separate table for
scrolling). This table speciﬁes one or more curves deﬁned
by a series of segments and a scale level. The slider shown
in Figure 5 allows users to specify a desired scale among
the following: (slow) 0, 0.125, 0.3125, 0.5, 0.6875 (default),
0.875, 1, 1.5, 2, and 3 (fast). The system interpolates between
the curves provided by the driver to create one that matches
the desired scale and maps a vector magnitude to a CD gain
value. Then for each (dx, dy) displacement, it computes an
approximation of the vector magnitude using the same equa-
tion as Windows6, uses the created curve to ﬁnd the right CD
gain, applies it to dx and dy, adds the previous remainders
and returns the integral part of the result after updating the
remainders. These remainders are never cleared.
The acceleration curves stored in device drivers are
hardware-independent. When it interpolates between them,
the system takes the resolution of the input device into ac-
count. However, it uses hardwired constants for the resolu-
tion of the display (96 PPI) and the frequency of the input and
output devices (67 Hz). A detailed inspection of the drivers
available on OS X 10.6.7 showed that several of them use the
same tables. We identiﬁed two particular tables, one for mice
and the other for touchpads, that seem to be used by all such
devices that rely on Apple’s drivers.
OS X transfer functions are available in libpointing
through URIs such as osx:<name or path>?scale=0.5.
The names mouse and touchpad can be used to load one
of the generic acceleration tables that we found. A spe-
ciﬁc table can also be loaded from a ﬁle by specifying its
path. The scale parameter encodes the desired scale. Fig-
ure 8 shows the curves associated to each slider position for
generic mice and touchpads. Note that contrary to what it
may seem in both cases, the unitless gain obtained for a scale
of 0 is not always 1 but ﬂuctuates between 0.9 and 1. From
what we know, a constant CD gain is not achievable using
these generic tables, even a naive one.
Although it can stay close in some situations, a cursor con-
trolled by our osx: implementation does not remain su-
perimposed with the genuine one. The reason appears to
be some additional control mechanisms implemented in IO-
HIDSystem.cpp. Our current understanding is that these
mechanisms feed the output of the function we just de-
scribed into a trajectory prediction algorithm that schedules
on-screen cursor updates synchronized with display refresh.
No correction seems to be implemented in case a prediction
was wrong, though. In effect, the whole acts as a low-pass
ﬁlter on cursor movements. We hypothesize this explains
the upward shift between the curves shown in Figure 3 and
6All computations are also made using ﬁxed-point arithmetic.
those in Figure 8 (above plot). Our present inability to sched-
ule calls synchronized with display refresh prevents us from
replicating these mechanisms, but we are currently investi-
gating ways to circumvent this problem.
xorg:
The pointer acceleration mechanisms currently used by Xorg
were introduced in 2008. The source code for these mech-
anisms is publicly available as part of the Xorg source
tree7. It was again relatively easy for us to isolate the rel-
evant portions of code (about 1500 lines of code, mainly in
dix/ptrveloc.c) and to add the necessary wrappers and deﬁ-
nitions to make them compile on Windows and OS X. This
time, documentation for the design rationales and operating
principles was also available8, although a bit cryptic.
The changes introduced in Xorg in 2008 notably aimed at
facilitating the exploration of transfer functions. The cur-
rent architecture of the code supports 9 different proﬁles
implemented within the new “predictable” scheme and the
older “lightweight” scheme “retained mostly for embedded
scenarios”. Proﬁles can be considered as different transfer
functions, although they share some common mechanisms
and code. Numerous conﬁguration settings are associated to
them. But genericity and ﬂexibility have a price: not only is
the Xorg code for pointer acceleration much larger than the
one used on other systems, but it is also far less readable.
The “predictable” scheme computes the euclidean distance
corresponding to each displacement reported by the device
and divides it by the time elapsed since the previous one.
This instantaneous velocity is stored in a short history list
(n = 16 by default) that is used to maintain a better esti-
mation of the real pointing device velocity. Two adjustable
settings also play an important part: acceleration, given as a
fraction, and threshold. The ﬁrst one deﬁnes a high value for
the (naive) CD gain to be applied to displacements, consid-
ering a default low value of 1. The second one deﬁnes the
minimum velocity that needs to be achieved to switch from
the low gain to the high one. The active proﬁle speciﬁes how
the estimated velocity will be used to determine the actual
CD gain within these constraints. All computations are made
with ﬂoating-point arithmetic. Remainders are preserved and
never cleared.
The Xorg “predictable” transfer functions are available in
libpointing through URIs such as xorg:<profile>
?accnum=2&accden=1&thr=4 where <profile> names
one of the 9 available proﬁles, accnum and accden deﬁne
the acceleration fraction and thr the threshold. On Ubuntu
10.10, a cursor controlled by our implementation remains su-
perimposed with the genuine one.
It should be noted that a wide variety of command-line and
graphical interfaces exists to conﬁgure the different proﬁles
and their settings. Figure 10 shows the conﬁguration inter-
face available in the “Pointer speed” section of the “Mouse
preferences” application of Ubuntu 10.10. Although the code
that we use is not functionally limited to it, we will now fo-
7http://cgit.freedesktop.org/xorg/xserver/tree/
8http://xorg.freedesktop.org/wiki/Development/
Documentation/PointerAcceleration
Paper Session: Pointing
UIST’11, October 16–19, 2011, Santa Barbara, CA, USA
610

cus on the default proﬁle used by Ubuntu (“classic”) and the
relevant settings that can be adjusted through this particular
interface.
Figure 10: Ubuntu 10.10 conﬁguration interface. A help
page says about the ﬁrst slider: “Use the slider to spec-
ify the speed at which your mouse pointer moves on your
screen when you move your mouse”. About the second:
“Use the slider to specify how sensitive your mouse pointer
is to movements of your mouse”.
When the threshold is non-null, the “classic” proﬁle imple-
ments a smooth transition between the low and high gain val-
ues. The sliders shown in Figure 10 only allow such conﬁg-
urations. As the label indicates, the upper slider controls the
acceleration setting. When dragged, it feels like a contin-
uous control but actually supports only a predeﬁned set of
values: (slow) 3/10, 4/10, 5/10, 6/10, 7/10, 8/10, 9/10, 10/10,
1/1, 3/2, 2/1 (default), 5/2, 3/1, 7/2, 4/1, 9/2, 5/1, 11/2, and
6/1 (fast). The bottom slider controls the threshold and ac-
tually feels like a discrete control. The available values are:
(low) 1, 2, 3, 4 (default), 5, 6, 7, 8, 9, and 10 (high). In
total, the interface shown in Figure 10 thus gives access to
19× 10 = 190 conﬁgurations of the “classic” proﬁle.
Figure 7 shows a plot of these 190 functions. As one would
expect, the 90 functions with an acceleration setting lesser or
equal than 1, those labeled */10-*, correspond to a naive con-
stant gain of 1 (considering the 400 CPI and 96 PPI used for
plotting the curves). Note that this is the only naive constant
gain achievable through the interface shown in Figure10 and
that this interface does not allow to achieve a unitless con-
stant gain.
Summary
Figure 9 shows the default transfer functions used by Win-
dows, OS X and Xorg. Overall, despite a few differences,
the different families have a lot in common.
The three systems take only partially into account the char-
acteristics of the input and output devices. OS X is the only
system that uses the real resolution of the input device (Win-
dows assumes a 400 CPI resolution and Xorg does not use
it). Xorg is the only system that takes input event times into
account (the two others use harwired constant frequencies).
Xorg completely ignores the display frequency and resolu-
tion while OS X uses hardwired constants for them (Win-
dows varies on that topic).
All systems use a non linear function by default, but Win-
dows and Xorg also support the use of naive constant gain
functions. As the systems fail to properly take into account
the resolution and frequency of the devices, none actually
supports a unitless constant gain.
Windows and OS X both use ﬁxed-point arithmetic. The
three systems work with integer pixel coordinates but pre-
serve the remainders to achieve subpixel precision when
pointing. Windows 7, Mac OS X and Xorg never clear these
remainders while they are cleared using different strategies
on Windows XP and Vista.
The comparison of our custom cursors with the three system
ones validated our Windows and Xorg implementations but
revealed a slight difference for OS X presumably due to a
trajectory prediction algorithm requiring information we are
not yet able to provide.
EXPERIMENT
Our initial motivation for this experiment was to compare the
performance of real-world transfer functions. Assuming they
were probably used by many people and somewhat represen-
tative of theses systems, we decided to compare the default
functions used by Windows, OS X and Xorg. We also added
a constant CD gain function, as they are often used as a base-
line for comparing pointing facilitation techniques.
Apparatus
A 400 CPI USB corded Logitech mouse was used as input
device. A low-end model was preferred to a high-resolution
one as 400 CPI is the default resolution considered by all
systems. We used a 23" LCD display at a 1920× 1200 reso-
lution (98.5 PPI). The experiment was coded in C++ with the
QT framework on a Windows 7 Professional machine with a
NVidia GeForce GTX 460 graphics card. Our libpointing
toolkit was used to get raw input from the mouse and apply
the different transfer functions. Vertical synchronization of
the display was disabled in order to be able to update our
cursor’s position at the mouse frequency (125 Hz). In this
conﬁguration, our controlled cursor was slightly in advance
compared to the system one, which prevented any confound-
ing effect of lag in the experiment.
Task
We used a reciprocal one dimensional pointing task (Figure
11). Each trial began after the previous target was success-
fully selected and ended with the selection of the current tar-
get. After a target was successfully selected, it turned grey
and the next one (on the other side of the screen) turned
green. If a participant missed a target, a sound was heard
and an error was logged. Participants had to successfully se-
lect the current target before moving to the next one, even if
it required multiple clicks. Participants used the left mouse
button to select targets. After each block of trials, a cumula-
tive error rate was displayed and a message encouraged par-
ticipants to conform to an approximately 4% error rate by
speeding up or slowing down.
Participants
Sixteen unpaid participants with a mean age of 30.6(SD = 7.8,
min = 23, max = 46) served in the experiment (15 male and
1 female, 13 right-handed and 3 left-handed). All participants
worked most of their time with a computer. Three partici-
pants used exclusively OS X, four Windows 7, three Ubuntu
10.10. Two used Ubuntu 10.10 and Windows 7, two OS
X and Windows 7, one Ubuntu 10.10 and OS X, and one
Windows 7 and Ubuntu 10.10. Four participants used the
mouse exclusively, two the touchpad and the remainder both
devices. Among the sixteen participants, twelve kept the de-
fault settings for the mouse or touchpad while four slightly
Paper Session: Pointing
UIST’11, October 16–19, 2011, Santa Barbara, CA, USA
611

distance (D)
width (W)
(a) target(b)
Figure 11: Experimental display. Targets were rendered as
solid vertical bars equidistant from the center of the display
in opposite directions along the horizontal axis. The target
to be selected was colored green (a), and the previous one
gray (b). The cursor was represented by a one-pixel-thick
black cross 10 pixels wide.
increased the speed of their cursor by moving the slider in
their conﬁguration panel one or two ticks to the right.
Design
A repeated measures within-subjects design was used. The
independent variables were the transfer function used ( TF)
and the target width (WIDTH ).
Target distance was kept constant at 299.9 mm = 1,163 pix-
els. We decided for this moderate single distance because
Casiez et al. had found stronger differences between constant
CD gain and the Windows XP functions for small targets and
long distances9. This decision was taken to reduce the dura-
tion of the experiment and to highlight the effect of WIDTH .
The rationale was also that if no effect of TF was found with
these settings, it would be likely that no such effect exists.
WIDTH was evaluated with four levels: W 9pix = 2.32 mm
= 9 pixels, W 6pix = 1.55 mm = 6 pixels, W 3pix = 0.77 mm
= 3 pixels, W 1pix = 0.26 mm = 1 pixel. Targets three pixels
wide are common when resizing a window or clicking be-
tween two letters to position a text cursor. One pixel targets
are less frequent but occur for example when selecting ad-
jacent vertices or edges without zooming in vector drawing
applications. The index of difﬁculty ranged from 7.0 to 10.2.
The transfer functions evaluated were constant CD gain of
1.510 (Cst1.5), the default Windows 7 function (Win7), the
default OS X 10.6.7 function for mice (OSX) and the default
Xorg function (Xorg). According to Casiez et al.’s method [8]
and considering our experimental settings, the minimum gain
value to prevent clutching was 30/30 = 1 and the maxi-
mum value that could be chosen given quantization prob-
lems and human limbs precision was equal to min(400/98.5,
0.26/0.2) = 1.3. The chosen CD gain value of 1.5 represents
a good trade-off between these bounds and the CD gain value
of 2 often used as a baseline in pointing experiments.
9The largest distance in [8] for a similar desktop conﬁguration was 36 cm.
10Remainders were handled the same way as the other functions: they were
never reset.
Participants were introduced to the task and had about 30
seconds to get used to it. They then completed three succes-
sive BLOCKS for each TF. Each BLOCK consisted of 24 trials:
6 repetitions of the 4 WIDTHS . WIDTHS were presented in
decreasing order. The presentation order for TF was counter-
balanced across participants using a balanced Latin Square
design. Participants were encouraged to take a break after
every 6 trials. They had to press the spacebar once they felt
ready to start a new block. The desk was empty except for
the keyboard and screen, and participants were instructed to
use as much space as they wished to move the mouse. The
experiment lasted approximately 15 minutes.
In summary, the experimental design was: 16 participants×
4 TF× 3 BLOCKS× 4 WIDTH× 6 trials = 4,608 total trials.
RESULTS
The dependent variables were the error rate and the move-
ment time.
Error Rate
Targets that were not selected on the ﬁrst attempt were
marked as errors. Participants followed the instructions
with an overall error rate of 4.1%. A repeated measures
ANOV A showed a signiﬁcant effect ofWIDTH on error rate,
the latter increasing as target width decreases (F3,45=14.5,
p<0.001). Pairwise comparisons showed signiﬁcant differ-
ences between the smallest width and the three other widths
(p=0.001; W 1pix: 9.7%, W 3pix: 2.8%, W 6pix: 1.7%, W 9pix:
2.1%).
Movement Time
Movement time is the main dependent measure and is de-
ﬁned as the time taken to move from a target to the next one
and click on it. Targets marked as errors were removed from
the timing analysis. We also considered trials at least three
standard deviations away from the mean for eachTF×WIDTH
condition as outliers and removed them from the data analy-
sis (1.6% of the trials).
A repeated measures ANOV A showed that the presentation
order of TF had no signiﬁcant effect or interaction on move-
ment time, indicating that a within-participant design was ap-
propriate. Repeated measures ANOV A showed a signiﬁcant
effect of BLOCK (F2,30=14.2, p <0.001) on movement time.
Pairwise comparisons showed a signiﬁcant decrease in the
movement time between the ﬁrst block and the two remain-
ing (p<0.001; Block 1: 2.05 s, Block 2: 1.93 s, Block 3: 1.94 s).
The ﬁrst block was thus removed from subsequent analysis.
Repeated measures ANOV A showed a signiﬁcant main effect
of TF (F 3,45=20.7, p<0.001)), WIDTH (F3,45=244.4, p<0.001))
and a signiﬁcant TF × WIDTH interaction (F9,135=3.2,
p=0.023)) on movement time (Figure 12). Post-hoc analy-
sis showed signiﬁcant differences between Cst1.5 and the
three other transfer functions (p<0.001, Cst1.5: 2.22 s, OSX:
1.86 s, Win7: 1.81 s, Xorg: 1.84 s). This shows that Cst1.5 is
more than 20% slower compared to the three default transfer
functions. We did not control for clutching but according to
the experimenter observation, it was infrequent for all condi-
tions. When it occurred, it was at the beginning of the ﬁrst
block which was removed from the time analysis.
Paper Session: Pointing
UIST’11, October 16–19, 2011, Santa Barbara, CA, USA
612

!"!#
!"$#
!"%#
!"&#
!"'#
("!#
("$#
("%#
("&#
("'#
$"!#
$"$#
$"%#
$"&#
$"'#
)"!#
)"$#
*(+,-# *)+,-# *&+,-# *.+,-#
!"#$%$&'()%$(*+,(
-./'0(
/01("2#
345#
*,67#
589:#
Figure 12: Mean movement time for TF and WIDTH , error
bars representing 95% conﬁdence interval.
For W9pix, pairwise comparisons11 showed signiﬁcant differ-
ences (p<0.001) between Cst1.5 and the three other transfer
functions. We also observed signiﬁcant difference (p=0.013)
between OSX and Win7 (Cst1.5: 1.78 s, OSX: 1.47 s, Win7:
1.33 s, Xorg: 1.33 s). For W 6pix pairwise comparisons
showed signiﬁcant differences (p<0.002) between Cst1.5 and
the other functions. OSX showed again signiﬁcant differ-
ence (p=0.001) with Win7 (Cst1.5: 1.96 s, OSX: 1.63 s, Win7:
1.48 s, Xorg: 1.48 s). For W 3pix, we again observed sig-
niﬁcant differences (p<0.002) between Cst1.5 and the other
functions. However, the signiﬁcant difference between OSX
and Win7 disappears (Cst1.5: 2.29 s, OSX: 1.88 s, Win7: 1.81 s,
Xorg: 1.87 s). For W 1pix, we observed signiﬁcant differences
(p<0.048) between OSX and Cst1.5, Xorg (Cst1.5: 2.85 s, OSX:
2.46 s, Win7: 2.63 s, Xorg: 2.69 s).
Our results show there is no single function that is best for
all target widths. Win7 and Xorg improve movement time by
more than 9% compared to OSX and more than 24% com-
pared to Cst1.5 for widths 6 and 9 pixels. However, the dif-
ference with OSX disappears for 3 and 1 pixels targets. In
contrast, OSX improves movement time by 13% compared
to Cst1.5 and 8% compared to Xorg for the 1 pixel target
when the other functions do not show signiﬁcant differences.
Qualitative Feedback
At the end of the experiment, participants were asked if they
found some differences in the control of the cursor. All no-
ticed there was a condition (Cst1.5) where they had to move
the mouse over greater distances to reach targets and com-
plained it was less comfortable than the other conditions.
None of the participants was able to notice a difference be-
tween the three other conditions (Win7, OSX and Xorg).
DISCUSSION
The knowledge acquired by studying, replicating and com-
paring the transfer functions used by three different systems
brings us to the following suggestions.
Choosing a Baseline Transfer Function
The use of a constant CD gain function as a baseline to
compare with other techniques should be prohibited unless
11Using Bonferroni correction for all post-hoc analysis.
clearly justiﬁed. None of the prevalent systems uses such a
function by default and it might not even be obtainable on
some, like OS X. As we explained in the previous section,
most participants of our experiment declared using the de-
fault settings of their system, and results from the experiment
show that these default functions outperform a constant CD
gain. We thus recommend to use the default transfer function
of the considered system as a baseline condition.
Reporting Transfer Functions
To facilitate the replication or reproduction of pointing tech-
niques and experiments, we recommend that researchers pro-
vide extensive details concerning the transfer function(s)
they used.
If constant CD gains were used, we recommend to report
them using unitless values in order to abstract them from
hardware speciﬁcs. Detailing how a constant gain was
achieved might also help detecting potential ﬂaws in the
methodology. As an example, it might be important to ex-
plain how remainders were handled as it remains unclear if
they can affect performance. If a system function was used,
the system and its particular conﬁguration settings should
be unambiguously described. A screen-shot is probably the
most unambiguous way of reporting these settings. For com-
pleteness and as we have shown that some systems do not
take them into account, we also recommend to report the res-
olution and frequency of both the input and output devices.
For custom non linear functions, we recommend describing
them using ﬁgures or tables with physical units mapping the
device speed to the cursor speed or CD gain.
An alternative for describing transfer functions would be
to use a notation based on URIs, similar to what we
have started to do in libpointing. URIs are inter-
esting because they allow to combine a class descrip-
tion, an instance description and optional parameters, e.g.
windows:vista?setting=2&epp=false. They can be
given fully expanded, with all possible parameters, or in a
condensed form specifying only the ones differing from de-
fault values. If libpointing indeed turns into a living
archive for transfer functions, we will certainly need some
registry to standardize and ofﬁcialize these notations.
In addition to the transfer function(s) used, the latency of the
system might also be worthwhile to report as it can impact
performance and might be a confounding variable. We ac-
knowledge that measuring it is quite difﬁcult. But some of
the parameters that affect it can probably be described, such
as the characteristics of the communication link between the
input device and the computer, or the synchronization char-
acteristics of the display.
Conﬁguration Interfaces and Documentation
As we already stated, transfer functions should be deﬁned in
hardware-independent ways. Their implementation should
thus be given either hardware-independent data, or the in-
formation to do the required conversions. In an ideal world,
pointing device manufacturers would take full advantage of
the HID speciﬁcation to put all the necessary information in
their device descriptions. Unfortunately, the reality is quite
different... As systems are often forced to make educated
Paper Session: Pointing
UIST’11, October 16–19, 2011, Santa Barbara, CA, USA
613

guesses about device characteristics, we believe these should
be visible and modiﬁable in the relevant conﬁguration inter-
faces. Exposing wrongly estimated values should help raise
the level of consciousness of the public about the difference
between input resolution and cursor speed, for example.
Considering the different understandings of the current in-
terfaces used for tuning the system transfer functions, even
among researchers, we believe these interfaces should at least
be properly documented if not completely redesigned.
CONCLUSION AND FUTURE WORK
In this paper, we presented a custom device and a toolkit that
helped us characterize, replicate and compare the pointing
transfer functions used on a daily basis by millions of people
around the world. We showed in a controlled experiment that
the default transfer functions used in Windows, OS X and
Xorg outperform a constant CD gain similar to those used by
most researchers. Our results also show a signiﬁcant inter-
action between transfer function and target width suggesting
that more work needs to be done to understand how these
functions affect performance.
This work represents an important step in the understand-
ing and study of pointing transfer functions. A long term
goal is to improve the design of transfer functions by taking
more into account the hardware characteristics (i.e. mouse
vs. touchpad, desktop display vs. wall size display) and the
motor capabilities of the users. This includes the study of
management strategies for remainders which we hypothesize
can be important for the selection of small targets. We are
also interested in the study of the impact of the transfer func-
tion in relation with the task: a function performing well for
pointing could degrade performance in other tasks like draw-
ing, steering or executing command gestures, for example.
In the short term, we plan to study the interaction of the de-
fault transfer functions with pointing facilitation techniques
manipulating CD gain, e.g. [5, 10, 23]. To our knowledge,
these technique were only implemented on top of a constant
CD gain and were also only evaluated against constant CD
gains. We also plan to investigate the use of indirect map-
pings on multitouch interfaces. On this topic, Buxton re-
cently said: “one of the things that I see most neglected is
any consideration of when to use relative vs absolute control
and varying, including when and how to effectively and dy-
namically switch from one to the other, and when and how to
dynamically adjust C:D ratio” [6]. We could not agree more.
ACKNOWLEDGMENTS
We thank Damien Marchal and Mark Cranness for their help
in the understanding of transfer functions and their contribu-
tion to libpointing.
REFERENCES
1. Pointer ballistics for Windows XP. Archived white paper,
Windows Hardware Developer Center, Oct. 2002.
2. T. Asano, E. Sharlin, Y . Kitamura, K. Takashima, and
F. Kishino. Predictive interaction using the Delphian Desk-
top. Proceedings of UIST’05, 133–141. ACM, 2005.
3. M. Bergman, T. Peurach, T. Schmidt, S. McGowan,
J. Crowe, R. Dezmelyk, R. Zimmermann, M. Van Flandern,
B. Nathan, M. Davis, and J. Rayhawk. Device class deﬁni-
tion for human interface devices (HID). Version 1.11, USB
Implementers’ Forum, June 2001.
4. T. Berners-Lee, R. Fielding, and L. Masinter. Uniform Re-
source Identiﬁer (URI): generic syntax. RFC 3986, IETF,
Jan. 2005.
5. R. Blanch, Y . Guiard, and M. Beaudouin-Lafon. Semantic
pointing: improving target acquisition with control-display
ratio adaptation. Proceedings of CHI’04, 519–526. ACM,
2004.
6. W. Buxton, M. Billinghurst, Y . Guiard, A. Sellen, and
S. Zhai. Human input to computer systems: theories,
techniques and technology. 2011. Working draft, http:
//www.billbuxton.com/inputManuscript.html.
7. G. Casiez and D. V ogel. The effect of spring stiffness and
control gain with an elastic rate control pointing device. Pro-
ceeding of CHI’08, 1709–1718. ACM, 2008.
8. G. Casiez, D. V ogel, R. Balakrishnan, and A. Cockburn.
The impact of control-display gain on user performance in
pointing tasks. Human-Computer Interaction, 23(3):215–
250, 2008.
9. O. Chapuis, J.-B. Labrune, and E. Pietriga. DynaSpot: speed-
dependent area cursor. Proceedings of CHI’09, 1391–1400.
ACM, 2009.
10. A. Cockburn and A. Firth. Improving the acquisition of small
targets. Proceedings of HCI’03, 77–80. BCS, 2003.
11. E. D. Graham. Virtual pointing on a computer display: non-
linear control-display mappings. Proceedings of GI’96,
39–46. Canadian Information Processing Society, 1996.
12. T. Grossman and R. Balakrishnan. The bubble cursor: en-
hancing target acquisition by dynamic resizing of the cursor’s
activation area. Proceedings of CHI’05, 281–290. ACM,
2005.
13. K. Hinckley. Input technologies and techniques. A. Sears and
J. A. Jacko, editors, Human Computer Interaction Handbook
(2nd edition). CRC Press, Sept. 2007.
14. H. D. Jellinek and S. K. Card. Powermice and user perfor-
mance. Proceedings of CHI’90, 213–220. ACM, 1990.
15. M. Kobayashi and T. Igarashi. Ninja cursors: using multiple
cursors to assist target acquisition on large screens. Proceed-
ing of CHI’08, 949–958. ACM, 2008.
16. I. S. MacKenzie. Input devices and interaction techniques
for advanced computing. W. Barﬁeld and T. A. F. III, editors,
Virtual environments and advanced interface design, 437–
470. 1995.
17. I. S. MacKenzie and P. Isokoski. Fitts’ throughput and the
speed-accuracy tradeoff. Proceeding of CHI’08, 1633–1636.
ACM, 2008.
18. R. L. Mandryk and C. Gutwin. Perceptibility and utility of
sticky targets. Proceedings of graphics interface 2008, GI
’08, 65–72. Canadian Information Processing Society, 2008.
19. D. E. Meyer, R. A. Abrams, S. Kornblum, C. E. Wright, and
J. E. K. Smith. Optimality in human motor performance:
Ideal control of rapid aimed movements. Psychological
Review, 95(3):340–370, 1988.
20. B. Moggridge. Designing interactions. The MIT Press, Oct.
2006.
21. U. Tränkle and D. Deutschmann. Factors inﬂuencing speed
and precision of cursor positioning using a mouse. Er-
gonomics, 34(2):161–174, 1991.
22. J. O. Wobbrock, J. Fogarty, S.-Y . S. Liu, S. Kimuro, and
S. Harada. The Angle Mouse: target-agnostic dynamic
gain adjustment based on angular deviation. Proceedings
of CHI’09, 1401–1410. ACM, 2009.
23. A. Worden, N. Walker, K. Bharat, and S. Hudson. Making
computers easier for older adults to use: area cursors and
sticky icons. Proceedings of CHI’97, 266–271. ACM, 1997.
Paper Session: Pointing
UIST’11, October 16–19, 2011, Santa Barbara, CA, USA
614